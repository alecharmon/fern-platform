import { type NextRequest, NextResponse } from "next/server";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorkflowStatusRequest {
    owner: string;
    repoName: string;
    commitSha?: string; // Optional: filter workflows by this commit SHA
}

export type WorkflowStatus =
    | { status: "not_found" }
    | { status: "queued" }
    | { status: "in_progress"; steps: WorkflowStep[] }
    | { status: "completed"; conclusion: "success" | "failure" | "cancelled"; steps: WorkflowStep[] }
    | { status: "error"; message: string };

interface WorkflowStep {
    name: string;
    status: "queued" | "in_progress" | "completed";
    conclusion?: "success" | "failure" | "skipped" | "cancelled" | null;
}

/**
 * Polls for the latest GitHub Actions workflow run status.
 * Used by the complete page to show build progress.
 */
export async function POST(req: NextRequest): Promise<NextResponse<WorkflowStatus>> {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    let data: WorkflowStatusRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ status: "error", message: "Invalid request body" }, { status: 400 });
    }

    if (!data.owner || !data.repoName) {
        return NextResponse.json({ status: "error", message: "owner and repoName are required" }, { status: 400 });
    }

    try {
        const octokitResult = getDemoCreationBotOctokit();
        if (!octokitResult.ok) {
            return NextResponse.json({ status: "error", message: "Server configuration error" }, { status: 500 });
        }

        const octokit = octokitResult.octokit;

        // Get workflow runs, optionally filtered by commit SHA
        const runsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
            owner: data.owner,
            repo: data.repoName,
            per_page: 10, // Fetch more to find the right one if filtering by SHA
            ...(data.commitSha ? { head_sha: data.commitSha } : {})
        });

        if (runsResponse.data.workflow_runs.length === 0) {
            return NextResponse.json({ status: "not_found" });
        }

        // Get the most recent run (or the one matching the commit SHA if provided)
        const latestRun = runsResponse.data.workflow_runs[0];

        if (!latestRun) {
            return NextResponse.json({ status: "not_found" });
        }

        // Get jobs for this run to get step details
        const jobsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", {
            owner: data.owner,
            repo: data.repoName,
            run_id: latestRun.id
        });

        const steps: WorkflowStep[] = [];
        for (const job of jobsResponse.data.jobs) {
            if (job.steps) {
                for (const step of job.steps) {
                    steps.push({
                        name: step.name,
                        status: step.status as "queued" | "in_progress" | "completed",
                        conclusion: step.conclusion as WorkflowStep["conclusion"]
                    });
                }
            }
        }

        if (latestRun.status === "queued") {
            return NextResponse.json({ status: "queued" });
        }

        if (latestRun.status === "in_progress") {
            return NextResponse.json({ status: "in_progress", steps });
        }

        if (latestRun.status === "completed") {
            const conclusion = latestRun.conclusion as "success" | "failure" | "cancelled";
            return NextResponse.json({ status: "completed", conclusion, steps });
        }

        // Unknown status, treat as in progress
        return NextResponse.json({ status: "in_progress", steps });
    } catch (error) {
        console.error("Error fetching workflow status:", error);
        return NextResponse.json(
            { status: "error", message: error instanceof Error ? error.message : "Failed to fetch status" },
            { status: 500 }
        );
    }
}
