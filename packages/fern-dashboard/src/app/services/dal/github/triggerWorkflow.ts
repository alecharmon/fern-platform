"use server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";

export interface TriggerWorkflowRequest {
    owner: string;
    repoName: string;
    workflowId: string; // e.g., "publish-docs.yml"
    ref?: string; // Branch to run on, defaults to "main"
}

export type TriggerWorkflowResult = { success: true } | { success: false; error: string };

/**
 * Triggers a GitHub Actions workflow via the workflow_dispatch event.
 */
export async function triggerWorkflow(request: TriggerWorkflowRequest): Promise<TriggerWorkflowResult> {
    const { owner, repoName, workflowId, ref = "main" } = request;

    try {
        const result = getDemoCreationBotOctokit("triggerWorkflow.ts:triggerWorkflow");
        if (!result.ok) {
            return { success: false, error: "Demo creation bot token not configured" };
        }

        await result.octokit.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
            owner,
            repo: repoName,
            workflow_id: workflowId,
            ref
        });

        return { success: true };
    } catch (error) {
        console.error("[triggerWorkflow] Error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
