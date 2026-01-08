"use server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";

export type TriggerWorkflowResult =
    | { success: true }
    | {
          success: false;
          error: {
              type: "MISSING_BOT_TOKEN" | "WORKFLOW_TRIGGER_FAILED";
              message: string;
          };
      };

/**
 * Triggers a GitHub Actions workflow via workflow_dispatch.
 *
 * @param owner - The repository owner (username or organization)
 * @param repoName - The repository name
 * @param workflowId - The workflow file name (e.g., "publish-docs.yml")
 * @param ref - The branch to run the workflow on (defaults to "main")
 * @returns Result indicating success or failure
 */
export async function triggerWorkflow(params: {
    owner: string;
    repoName: string;
    workflowId: string;
    ref?: string;
}): Promise<TriggerWorkflowResult> {
    const { owner, repoName, workflowId, ref = "main" } = params;

    try {
        const octokitResult = getDemoCreationBotOctokit();
        if (!octokitResult.ok) {
            return {
                success: false,
                error: {
                    type: "MISSING_BOT_TOKEN",
                    message: "Failed to get demo creation bot token"
                }
            };
        }

        const octokit = octokitResult.octokit;

        // Retry triggering the workflow with delays
        // GitHub needs time to index new workflow files before they can be dispatched
        const maxRetries = 5;
        const delayMs = 2000; // 2 seconds between retries

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await octokit.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
                    owner,
                    repo: repoName,
                    workflow_id: workflowId,
                    ref
                });
                console.log(`Workflow dispatch succeeded on attempt ${attempt}`);
                return { success: true };
            } catch (dispatchError: any) {
                console.log(`Workflow dispatch attempt ${attempt}/${maxRetries} failed:`, dispatchError.message);
                if (attempt < maxRetries) {
                    // Wait before retrying - GitHub may not have indexed the workflow yet
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                } else {
                    throw dispatchError;
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to trigger workflow:", error);
        return {
            success: false,
            error: {
                type: "WORKFLOW_TRIGGER_FAILED",
                message: error instanceof Error ? error.message : "Unknown error occurred"
            }
        };
    }
}
