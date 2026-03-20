import "server-only";

import { getFernBotOctokitForRepo } from "../auth0/fernBotOctokit";

export interface WorkflowStep {
    name: string;
    status: "queued" | "in_progress" | "completed";
    conclusion?: "success" | "failure" | "skipped" | "cancelled" | null;
    startedAt?: string | null;
    completedAt?: string | null;
}

export interface WorkflowJob {
    name: string;
    status: "queued" | "in_progress" | "completed";
    conclusion?: "success" | "failure" | "skipped" | "cancelled" | null;
    steps: WorkflowStep[];
}

export type WorkflowStepsResult =
    | { status: "ok"; runStatus: string; runConclusion: string | null; jobs: WorkflowJob[] }
    | { status: "error"; message: string };

/**
 * Fetches GitHub Actions workflow steps for a specific run using fern-bot.
 * This is a server-only function — not exposed as an HTTP endpoint.
 */
export async function getDeploymentWorkflowSteps({
    owner,
    repo,
    runId
}: {
    owner: string;
    repo: string;
    runId: number;
}): Promise<WorkflowStepsResult> {
    if (!owner || !repo || !runId) {
        return { status: "error", message: "owner, repo, and runId are required" };
    }

    try {
        const octokitResult = await getFernBotOctokitForRepo(owner, repo);
        if (!octokitResult.ok) {
            const errorMessage =
                octokitResult.error.type === "NOT_INSTALLED"
                    ? `fern-bot is not installed on ${owner}/${repo}`
                    : `GitHub authentication error: ${octokitResult.error.type}`;
            return { status: "error", message: errorMessage };
        }

        const octokit = octokitResult.octokit;

        const runResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
            owner,
            repo,
            run_id: runId
        });

        const jobsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", {
            owner,
            repo,
            run_id: runId
        });

        const jobs: WorkflowJob[] = jobsResponse.data.jobs.map((job) => ({
            name: job.name,
            status: job.status as WorkflowJob["status"],
            conclusion: job.conclusion as WorkflowJob["conclusion"],
            steps: (job.steps ?? []).map((step) => ({
                name: step.name,
                status: step.status as WorkflowStep["status"],
                conclusion: step.conclusion as WorkflowStep["conclusion"],
                startedAt: step.started_at,
                completedAt: step.completed_at
            }))
        }));

        return {
            status: "ok",
            runStatus: runResponse.data.status ?? "unknown",
            runConclusion: runResponse.data.conclusion,
            jobs
        };
    } catch (error) {
        console.error("[getDeploymentWorkflowSteps] Error:", error);
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch workflow steps"
        };
    }
}
