import { getPermissionsFromSession, hasPermission } from "@fern-api/user-permissions";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisGet } from "@/app/services/redis/redis";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

interface AddCollaboratorRequest {
    repoName: string;
    githubUsername: string;
    orgName: string;
    docsUrl?: string;
}

export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: AddCollaboratorRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.repoName || !data.githubUsername || !data.orgName) {
        return NextResponse.json({ error: "repoName, githubUsername, and orgName are required" }, { status: 400 });
    }

    // Security check 1: Verify the repo is owned by this org.
    // Try docs URL metadata first, fall back to onboarding Redis cache
    // (during onboarding, the docs URL may not be registered yet).
    let repoVerified = false;

    if (data.docsUrl) {
        const docsUrlMetadata = await getDocsUrlMetadata({
            url: data.docsUrl as DocsUrl,
            token: session.accessToken
        });

        if (docsUrlMetadata.ok) {
            if (docsUrlMetadata.body.org !== data.orgName) {
                return NextResponse.json(
                    { error: "Unauthorized: docs URL does not belong to this org" },
                    { status: 403 }
                );
            }

            if (docsUrlMetadata.body.gitUrl) {
                const parsedGitUrl = parseGitUrl(docsUrlMetadata.body.gitUrl);
                if (parsedGitUrl.repo !== data.repoName) {
                    console.error("[add-repo-collaborator] Repo mismatch:", {
                        requested: data.repoName,
                        actual: parsedGitUrl.repo
                    });
                    return NextResponse.json(
                        { error: "Repo name does not match the linked repository" },
                        { status: 403 }
                    );
                }

                const allowedOwners = ["fern-support", "fern", "fern-demo"];
                if (!parsedGitUrl.owner || !allowedOwners.includes(parsedGitUrl.owner)) {
                    console.error("[add-repo-collaborator] Owner not in allowlist:", {
                        owner: parsedGitUrl.owner,
                        allowedOwners
                    });
                    return NextResponse.json(
                        { error: "Repository owner is not authorized for collaborator additions" },
                        { status: 403 }
                    );
                }
            }

            repoVerified = true;
        } else {
            console.warn("[add-repo-collaborator] Docs URL metadata not found, falling back to onboarding cache");
        }
    }

    if (!repoVerified) {
        const onboardingStatus = await redisGet(RedisCacheKey.onboardingPreCreate(data.orgName));
        if (
            !onboardingStatus ||
            onboardingStatus.status !== "completed" ||
            onboardingStatus.repoName !== data.repoName
        ) {
            console.error("[add-repo-collaborator] Could not verify repo ownership:", {
                orgName: data.orgName,
                repoName: data.repoName,
                onboardingStatus: onboardingStatus?.status,
                onboardingRepo: onboardingStatus?.repoName
            });
            return NextResponse.json(
                { error: "Could not verify repository ownership. Please try again shortly." },
                { status: 404 }
            );
        }
        repoVerified = true;
    }

    // Security check 2: Verify user is a member of the org via Venus API
    try {
        const venusClient = getVenusClient({ token: session.accessToken });
        const isMemberResult = await venusClient.organization.isMember(data.orgName);
        if (!isMemberResult.ok || !isMemberResult.body) {
            return NextResponse.json({ error: "Unauthorized: user is not a member of this org" }, { status: 403 });
        }
    } catch (venusError) {
        console.error("Error checking org membership:", venusError);
        return NextResponse.json({ error: "Failed to verify org membership" }, { status: 500 });
    }

    // Validate GitHub username format (alphanumeric and hyphens, 1-39 chars)
    const usernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
    if (!usernameRegex.test(data.githubUsername)) {
        return NextResponse.json({ error: "Invalid GitHub username format" }, { status: 400 });
    }

    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
    if (!demoCreationBotOwner) {
        console.error("[add-repo-collaborator] FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    try {
        const octokitResult = getDemoCreationBotOctokit("add-repo-collaborator/route.ts:POST");
        if (!octokitResult.ok) {
            console.error("[add-repo-collaborator] Failed to get GitHub client:", octokitResult.error);
            throw new Error("Failed to get GitHub client");
        }

        // First verify the repo exists and is owned by the demo bot
        try {
            await octokitResult.octokit.request("GET /repos/{owner}/{repo}", {
                owner: demoCreationBotOwner,
                repo: data.repoName
            });
        } catch (repoError: any) {
            if (repoError.status === 404) {
                return NextResponse.json({ error: "Repository not found" }, { status: 404 });
            }
            throw repoError;
        }

        // Add the user as a collaborator (admins get admin access for repo transfer)
        const permissions = getPermissionsFromSession({ sessionPermissions: session.permissions });
        await octokitResult.octokit.request("PUT /repos/{owner}/{repo}/collaborators/{username}", {
            owner: demoCreationBotOwner,
            repo: data.repoName,
            username: data.githubUsername,
            permission: hasPermission(permissions, "manage-settings") ? "admin" : "push"
        });

        // Invalidate cached collaborator count so the banner updates
        revalidateTag(`collaborator-count:${demoCreationBotOwner}/${data.repoName}`);

        return NextResponse.json({
            success: true,
            message: `Invitation sent to ${data.githubUsername}`
        });
    } catch (error: any) {
        console.error("Error adding collaborator:", error);

        // Handle specific GitHub API errors
        if (error.status === 404) {
            return NextResponse.json({ error: "GitHub user not found. Please check the username." }, { status: 404 });
        }
        if (error.status === 422) {
            return NextResponse.json(
                { error: "User is already a collaborator or invitation is pending." },
                { status: 422 }
            );
        }

        return NextResponse.json({ error: error.message || "Failed to add collaborator" }, { status: 500 });
    }
}
