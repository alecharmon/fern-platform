import { convert } from "@fern-platform/postman-to-openapi";
import type { Json } from "@fern-platform/supabase";
import { type NextRequest, NextResponse } from "next/server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getDocsGitUrl } from "@/app/services/dal/github/getDocsGitUrl";
import { updateRepository } from "@/app/services/dal/github/updateRepository";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { fetchPostmanCollection } from "@/app/services/postman/api";
import { getPostmanAccessToken } from "@/app/services/postman/jwt";
import { notifyPostman } from "@/app/services/postman/notifyPostman";
import { upsertOpenApiSpec } from "@/app/services/postman/openapi-repository";
import { getAppInstallationByTeamId, upsertAppInstallation } from "@/app/services/postman/repository";
import type { DocsUrl } from "@/utils/types";

import { validatePostmanAuth } from "../../auth";
import type { UpdateCollectionRequest, UpdateCollectionResponse } from "../../types";

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts a hostname suitable for FDR lookup from a published URL.
 * e.g. "https://sample.docs.buildwithfern.com/docid" -> "sample.docs.buildwithfern.com"
 */
function extractHostname(publishedUrl: string): string {
    try {
        const url = new URL(publishedUrl.startsWith("http") ? publishedUrl : `https://${publishedUrl}`);
        return url.hostname;
    } catch {
        return publishedUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }
}

type OctokitClient = ReturnType<typeof getDemoCreationBotOctokit> extends { ok: true; octokit: infer T } ? T : never;

/**
 * Finds the OpenAPI spec file path in the repo by searching the fern/apis directory.
 * Returns the path to the first openapi spec file found, or null if not found.
 */
async function findOpenApiSpecPath(octokit: OctokitClient, owner: string, repo: string): Promise<string | null> {
    try {
        const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo,
            path: "fern/apis"
        });

        if (!Array.isArray(data)) {
            return null;
        }

        for (const entry of data) {
            if (entry.type === "dir") {
                try {
                    const { data: subDirContents } = await octokit.request(
                        "GET /repos/{owner}/{repo}/contents/{path}",
                        {
                            owner,
                            repo,
                            path: entry.path
                        }
                    );

                    if (Array.isArray(subDirContents)) {
                        const specFile = subDirContents.find(
                            (f: { name: string; type: string }) =>
                                f.type === "file" &&
                                (f.name === "openapi.json" || f.name === "openapi.yaml" || f.name === "openapi.yml")
                        );
                        if (specFile) {
                            return specFile.path as string;
                        }
                    }
                } catch {
                    // Skip directories we can't read
                }
            }
        }
    } catch {
        // fern/apis directory might not exist
    }

    return null;
}

/**
 * Resolves the GitHub owner/repo from a published docs URL using the existing getDocsGitUrl utility.
 */
async function resolveGitRepo(publishedUrl: string): Promise<{ owner: string; repo: string } | null> {
    const hostname = extractHostname(publishedUrl);
    const gitUrlResult = await getDocsGitUrl(hostname as DocsUrl, process.env.FERN_TOKEN ?? "");

    if (!gitUrlResult.success) {
        console.warn(
            `[postman-update] Could not find GitHub repo for published URL ${publishedUrl}: ${gitUrlResult.error.type}`
        );
        return null;
    }

    const parsed = parseGitUrl(gitUrlResult.gitUrl);
    if (!parsed.owner || !parsed.repo) {
        console.warn(`[postman-update] Could not parse owner/repo from git URL: ${gitUrlResult.gitUrl}`);
        return null;
    }

    return { owner: parsed.owner, repo: parsed.repo };
}

/**
 * Updates the OpenAPI spec file in the GitHub repository.
 * Returns true if the update was successful, false otherwise.
 */
async function updateSpecInRepo(repoInfo: { owner: string; repo: string }, specContent: string): Promise<boolean> {
    const octokitResult = getDemoCreationBotOctokit("postman/update/collection/route.ts:updateSpecInRepo");
    if (!octokitResult.ok) {
        console.error("[postman-update] Failed to get demo creation bot octokit");
        return false;
    }

    const specFilePath = await findOpenApiSpecPath(octokitResult.octokit, repoInfo.owner, repoInfo.repo);
    if (!specFilePath) {
        console.warn(`[postman-update] No OpenAPI spec file found in ${repoInfo.owner}/${repoInfo.repo}`);
        return false;
    }

    const updateResult = await updateRepository({
        owner: repoInfo.owner,
        repoName: repoInfo.repo,
        files: [{ path: specFilePath, content: specContent }],
        message: "Update OpenAPI spec from Postman collection"
    });

    if (updateResult.success) {
        console.log(
            `[postman-update] Successfully updated ${specFilePath} in ${repoInfo.owner}/${repoInfo.repo} (commit: ${updateResult.commitSha})`
        );
        return true;
    }

    console.error(`[postman-update] Failed to update repo: ${updateResult.error}`);
    return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    let body: UpdateCollectionRequest;
    try {
        body = (await request.json()) as UpdateCollectionRequest;
    } catch (e) {
        console.warn("[postman-update] Failed to parse request body as JSON:", e);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.payload) {
        console.warn("[postman-update] Request body is missing 'payload' field. Received keys:", Object.keys(body));
        return NextResponse.json({ error: "payload is required" }, { status: 400 });
    }

    const { payload } = body;

    console.log(`[postman-update] Received payload keys: ${Object.keys(payload).join(", ")}`);
    console.log(`[postman-update] workspaceId in payload: ${JSON.stringify(payload.workspaceId)}`);

    if (!payload.collectionId) {
        console.warn("[postman-update] payload.collectionId is missing. Received payload keys:", Object.keys(payload));
        return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
    }

    if (!payload.userId || !payload.teamId) {
        console.warn(
            `[postman-update] Missing required fields - userId: ${payload.userId ? "present" : "missing"}, teamId: ${payload.teamId ? "present" : "missing"}, collectionId: ${payload.collectionId}`
        );
        return NextResponse.json({ error: "userId and teamId are required" }, { status: 400 });
    }

    if (!payload.publishedUrl) {
        console.warn(
            `[postman-update] payload.publishedUrl is missing for collectionId: ${payload.collectionId}, teamId: ${payload.teamId}`
        );
        return NextResponse.json({ error: "publishedUrl is required" }, { status: 400 });
    }

    // Look up the app installation for the team
    let installation = null;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        try {
            installation = await getAppInstallationByTeamId(payload.teamId);
        } catch (e) {
            console.error(`[postman-update] Error looking up installation for team ${payload.teamId}:`, e);
        }
        if (installation) {
            break;
        }
        if (attempt < MAX_POLL_ATTEMPTS - 1) {
            await delay(POLL_INTERVAL_MS);
        }
    }

    if (!installation) {
        return NextResponse.json(
            { error: `No app installation found for team ${payload.teamId} after ${MAX_POLL_ATTEMPTS} attempts` },
            { status: 404 }
        );
    }

    // Update team name and domain if provided, preserving existing values as fallbacks
    if (payload.teamName || payload.teamDomain) {
        try {
            await upsertAppInstallation({
                teamId: payload.teamId,
                sharedSecret: installation.shared_secret,
                appInstallationId: installation.app_installation_id,
                teamName: payload.teamName ?? installation.team_name ?? undefined,
                teamDomain: payload.teamDomain ?? installation.team_domain ?? undefined
            });
        } catch (e) {
            console.error("[postman-update] Failed to update team info:", e);
        }
    }

    // Get access token for Postman API
    let accessToken: string;
    try {
        accessToken = await getPostmanAccessToken({
            teamId: payload.teamId,
            installationAuthId: installation.app_installation_id,
            sharedSecret: installation.shared_secret
        });
    } catch (e) {
        console.error("[postman-update] Failed to get access token:", e);
        return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 });
    }

    // Re-fetch the Postman collection
    let collection: Record<string, unknown>;
    try {
        collection = await fetchPostmanCollection(accessToken, payload.collectionId);
    } catch (e) {
        console.error("[postman-update] Failed to fetch collection:", e);
        return NextResponse.json({ error: "Failed to fetch collection from Postman" }, { status: 502 });
    }

    // Convert to OpenAPI and update in database
    let openApiSpec: unknown;
    try {
        openApiSpec = convert(collection as Parameters<typeof convert>[0]);
        const upsertData = {
            teamId: payload.teamId,
            userId: payload.userId,
            collectionId: payload.collectionId,
            openApiSpec: openApiSpec as unknown as Json,
            workspaceId: payload.workspaceId
        };
        console.log(`[postman-update] Upserting spec with workspaceId: ${JSON.stringify(upsertData.workspaceId)}`);
        await upsertOpenApiSpec(upsertData);
    } catch (e) {
        console.error("[postman-update] Failed to convert/store OpenAPI spec:", e);
    }

    // Update the OpenAPI spec in the committed GitHub repo
    let repoUpdated = false;
    try {
        const repoInfo = await resolveGitRepo(payload.publishedUrl);
        if (repoInfo) {
            const specContent = openApiSpec
                ? JSON.stringify(openApiSpec, null, 2)
                : JSON.stringify(convert(collection as Parameters<typeof convert>[0]), null, 2);
            repoUpdated = await updateSpecInRepo(repoInfo, specContent);
        }
    } catch (e) {
        console.error("[postman-update] Error updating GitHub repo:", e);
    }

    // Notify Postman that the update is complete so it can exit the pending state.
    // Extract the site URL hostname from the publishedUrl for the notification.
    const siteUrl = extractHostname(payload.publishedUrl);
    try {
        console.log(
            `[postman-update] Notifying Postman of update completion: teamId=${payload.teamId}, collectionId=${payload.collectionId}, siteUrl=${siteUrl}`
        );
        await notifyPostman({
            teamId: payload.teamId,
            collectionId: payload.collectionId,
            siteUrl,
            generationStatus: "SUCCESS"
        });
        console.log("[postman-update] Successfully notified Postman of update completion");
    } catch (notifyError) {
        console.error("[postman-update] Failed to notify Postman of update completion:", notifyError);
    }

    const response: UpdateCollectionResponse = {
        success: true,
        collectionId: payload.collectionId,
        userId: payload.userId,
        teamId: payload.teamId,
        message: repoUpdated
            ? "Collection updated and repository synced"
            : "Collection updated (repository sync skipped)",
        collection,
        repoUpdated
    };

    return NextResponse.json<UpdateCollectionResponse>(response);
}
