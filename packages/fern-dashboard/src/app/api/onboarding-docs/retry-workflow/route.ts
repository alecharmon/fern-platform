import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { setFernTokenSecret } from "@/app/services/dal/github/setFernTokenSecret";
import { fernCliConfig } from "@/utils/fernCliConfig";

export const maxDuration = 60;

interface RetryWorkflowRequest {
    owner: string;
    repoName: string;
    orgName: string;
}

/**
 * POST /api/onboarding-docs/retry-workflow
 *
 * Resets the FERN_TOKEN secret and re-triggers the publish-docs workflow.
 * Used when the initial workflow failed due to missing or invalid FERN_TOKEN.
 */
export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: RetryWorkflowRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.owner || !data.repoName || !data.orgName) {
        return NextResponse.json({ error: "owner, repoName, and orgName are required" }, { status: 400 });
    }

    const { owner, repoName, orgName } = data;

    let tempDir: string | null = null;

    try {
        const octokitResult = getDemoCreationBotOctokit();
        if (!octokitResult.ok) {
            console.error("[retry-workflow] Failed to initialize GitHub client:", octokitResult.error);
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        const octokit = octokitResult.octokit;

        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-retry-workflow-"));
        const fernDir = path.join(tempDir, "fern");
        await fs.mkdir(fernDir, { recursive: true });

        await fs.writeFile(
            path.join(fernDir, "fern.config.json"),
            JSON.stringify({ organization: orgName, version: "*" }, null, 2)
        );

        const baseRepoName = orgName.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        const docsUrl = `${baseRepoName}.${fernCliConfig.docsDomain}`;
        await fs.writeFile(path.join(fernDir, "docs.yml"), `instances:\n  - url: ${docsUrl}\n\ntitle: Documentation\n`);

        console.log(`[retry-workflow] Resetting FERN_TOKEN for ${owner}/${repoName}`);
        const tokenResult = await setFernTokenSecret({
            owner,
            repoName,
            workingDir: tempDir,
            fernToken: session.accessToken,
            maxRetries: 3
        });

        if (!tokenResult.success) {
            console.error(`[retry-workflow] Failed to set FERN_TOKEN: ${tokenResult.error.message}`);
            return NextResponse.json(
                { error: `Failed to set FERN_TOKEN: ${tokenResult.error.message}` },
                { status: 500 }
            );
        }

        console.log(`[retry-workflow] FERN_TOKEN set successfully, triggering workflow`);

        try {
            await octokit.request("POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", {
                owner,
                repo: repoName,
                workflow_id: "publish-docs.yml",
                ref: "main"
            });
            console.log(`[retry-workflow] Workflow dispatched successfully`);
        } catch {
            console.warn(`[retry-workflow] Failed to dispatch workflow, trying to trigger via empty commit`);

            try {
                const { data: refData } = await octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
                    owner,
                    repo: repoName,
                    ref: "heads/main"
                });

                const { data: commitData } = await octokit.request(
                    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
                    {
                        owner,
                        repo: repoName,
                        commit_sha: refData.object.sha
                    }
                );

                const { data: newCommit } = await octokit.request("POST /repos/{owner}/{repo}/git/commits", {
                    owner,
                    repo: repoName,
                    message: "chore: retry docs publishing",
                    tree: commitData.tree.sha,
                    parents: [refData.object.sha]
                });

                await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                    owner,
                    repo: repoName,
                    ref: "heads/main",
                    sha: newCommit.sha
                });

                console.log(`[retry-workflow] Empty commit created to trigger workflow`);
            } catch (commitError) {
                console.error(`[retry-workflow] Failed to create empty commit:`, commitError);
                return NextResponse.json(
                    { error: "Failed to trigger workflow. Please try again or manually re-run the GitHub Action." },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "FERN_TOKEN reset and workflow triggered"
        });
    } catch (error) {
        console.error("[retry-workflow] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to retry workflow" },
            { status: 500 }
        );
    } finally {
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("[retry-workflow] Failed to cleanup temp directory:", cleanupError);
            }
        }
    }
}
