import type { NextRequest } from "next/server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180; // 3 minutes

interface LogEntry {
    type: "log" | "error" | "complete";
    message: string;
    timestamp: string;
}

/**
 * SSE endpoint that triggers GitHub Actions workflow and streams logs.
 * Query params:
 * - repoName: The repository name (required)
 * - siteUrl: The docs site URL (required)
 */
export async function GET(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const repoName = searchParams.get("repoName");
    const siteUrl = searchParams.get("siteUrl");

    if (!repoName || !siteUrl) {
        return new Response("repoName and siteUrl are required", { status: 400 });
    }

    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
    if (!demoCreationBotOwner) {
        return new Response("Server configuration error", { status: 500 });
    }

    const octokitResult = getDemoCreationBotOctokit();
    if (!octokitResult.ok) {
        return new Response("Failed to initialize GitHub client", { status: 500 });
    }

    const octokit = octokitResult.octokit;
    const owner = demoCreationBotOwner;

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: LogEntry) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            try {
                sendEvent({
                    type: "log",
                    message: "Starting publish workflow...",
                    timestamp: new Date().toISOString()
                });

                // Trigger the workflow
                const workflowId = "publish-docs.yml";
                const maxTriggerRetries = 5;
                const triggerDelayMs = 2000;

                let workflowTriggered = false;
                for (let attempt = 1; attempt <= maxTriggerRetries; attempt++) {
                    try {
                        await octokit.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
                            owner,
                            repo: repoName,
                            workflow_id: workflowId,
                            ref: "main"
                        });
                        workflowTriggered = true;
                        sendEvent({
                            type: "log",
                            message: "✓ Workflow triggered successfully",
                            timestamp: new Date().toISOString()
                        });
                        break;
                    } catch (err: any) {
                        if (attempt < maxTriggerRetries) {
                            sendEvent({
                                type: "log",
                                message: `Waiting for workflow to be ready (attempt ${attempt}/${maxTriggerRetries})...`,
                                timestamp: new Date().toISOString()
                            });
                            await new Promise((resolve) => setTimeout(resolve, triggerDelayMs));
                        } else {
                            throw new Error(
                                `Failed to trigger workflow after ${maxTriggerRetries} attempts: ${err.message}`
                            );
                        }
                    }
                }

                if (!workflowTriggered) {
                    throw new Error("Failed to trigger workflow");
                }

                // Wait a moment for the run to be created
                await new Promise((resolve) => setTimeout(resolve, 3000));

                sendEvent({
                    type: "log",
                    message: "Waiting for workflow run to start...",
                    timestamp: new Date().toISOString()
                });

                // Find the workflow run we just triggered
                let runId: number | null = null;
                const maxFindRetries = 20;
                const findDelayMs = 3000;

                for (let attempt = 1; attempt <= maxFindRetries; attempt++) {
                    const runsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
                        owner,
                        repo: repoName,
                        per_page: 5
                    });

                    // Find the most recent run that was triggered after we started
                    const recentRun = runsResponse.data.workflow_runs.find(
                        (run) => run.name === "Publish Docs" || run.path?.includes("publish-docs")
                    );

                    if (recentRun) {
                        runId = recentRun.id;
                        sendEvent({
                            type: "log",
                            message: `✓ Found workflow run #${runId}`,
                            timestamp: new Date().toISOString()
                        });
                        break;
                    }

                    if (attempt < maxFindRetries) {
                        await new Promise((resolve) => setTimeout(resolve, findDelayMs));
                    }
                }

                if (!runId) {
                    throw new Error("Could not find workflow run");
                }

                // Poll for workflow completion and stream job logs
                const maxPollAttempts = 60; // 5 minutes max
                const pollDelayMs = 5000;
                let lastLogLength = 0;
                let completionStatus: "success" | "failure" | null = null;

                for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
                    // Get workflow run status
                    const runResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}", {
                        owner,
                        repo: repoName,
                        run_id: runId
                    });

                    const run = runResponse.data;

                    // Get jobs for this run to stream their logs
                    const jobsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs", {
                        owner,
                        repo: repoName,
                        run_id: runId
                    });

                    // Stream logs from jobs
                    for (const job of jobsResponse.data.jobs) {
                        if (job.steps) {
                            for (const step of job.steps) {
                                const statusEmoji =
                                    step.conclusion === "success"
                                        ? "✓"
                                        : step.conclusion === "failure"
                                          ? "✗"
                                          : step.status === "in_progress"
                                            ? "⟳"
                                            : "○";

                                // Only send updates for steps that have started
                                if (step.status !== "queued") {
                                    const logMessage = `${statusEmoji} ${step.name}`;
                                    // Simple dedup - track what we've sent
                                    if (lastLogLength < job.steps.indexOf(step) + 1) {
                                        sendEvent({
                                            type: "log",
                                            message: logMessage,
                                            timestamp: step.started_at || new Date().toISOString()
                                        });
                                        lastLogLength = job.steps.indexOf(step) + 1;
                                    }
                                }
                            }
                        }
                    }

                    // Check if workflow is complete
                    if (run.status === "completed") {
                        completionStatus = run.conclusion === "success" ? "success" : "failure";
                        break;
                    }

                    await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
                }

                if (completionStatus === "success") {
                    sendEvent({
                        type: "log",
                        message: "✓ Docs published successfully!",
                        timestamp: new Date().toISOString()
                    });

                    // Link GitHub repo to docs site
                    if (session.accessToken) {
                        try {
                            sendEvent({
                                type: "log",
                                message: "Linking repository to docs site...",
                                timestamp: new Date().toISOString()
                            });

                            const githubRepoUrl = `https://github.com/${owner}/${repoName}`;
                            const postDocsGithubSourceHandler = (
                                await import("@/app/api/post-docs-github-source/handler")
                            ).default;

                            const linkResult = await postDocsGithubSourceHandler({
                                url: siteUrl,
                                token: session.accessToken,
                                githubUrl: githubRepoUrl
                            });

                            if (linkResult.ok) {
                                sendEvent({
                                    type: "log",
                                    message: "✓ Linked GitHub repository to docs site",
                                    timestamp: new Date().toISOString()
                                });
                            } else {
                                sendEvent({
                                    type: "log",
                                    message: "⚠ Failed to link GitHub repository (non-critical)",
                                    timestamp: new Date().toISOString()
                                });
                            }
                        } catch (error) {
                            console.error("Failed to link GitHub repo:", error);
                            sendEvent({
                                type: "log",
                                message: "⚠ Failed to link GitHub repository (non-critical)",
                                timestamp: new Date().toISOString()
                            });
                        }
                    }

                    // Send completion event
                    sendEvent({
                        type: "complete",
                        message: JSON.stringify({
                            success: true,
                            url: `https://${siteUrl}`,
                            githubRepoUrl: `https://github.com/${owner}/${repoName}`
                        }),
                        timestamp: new Date().toISOString()
                    });
                } else {
                    sendEvent({
                        type: "error",
                        message: `Workflow failed. Check the Actions tab for details: https://github.com/${owner}/${repoName}/actions`,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error("Publish stream error:", error);
                sendEvent({
                    type: "error",
                    message: error instanceof Error ? error.message : "Unknown error occurred",
                    timestamp: new Date().toISOString()
                });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}
