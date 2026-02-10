import { type NextRequest, NextResponse } from "next/server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getVenusClient } from "@/app/services/venus/getVenusClient";
import type { DocsUrl } from "@/utils/types";
import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddCollaboratorRequest {
    repoName: string;
    githubUsername: string;
    orgName: string;
    docsUrl: string;
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

    if (!data.repoName || !data.githubUsername || !data.orgName || !data.docsUrl) {
        return NextResponse.json(
            { error: "repoName, githubUsername, orgName, and docsUrl are required" },
            { status: 400 }
        );
    }

    // Security check 1: Verify the docs URL is owned by this org and get the linked repo
    const docsUrlMetadata = await getDocsUrlMetadata({
        url: data.docsUrl as DocsUrl,
        token: session.accessToken
    });

    if (!docsUrlMetadata.ok) {
        console.error("[add-repo-collaborator] Failed to load docs URL metadata:", docsUrlMetadata.error);
        return NextResponse.json({ error: "Docs URL not found or not registered" }, { status: 404 });
    }

    // Verify the org owns this docs URL
    if (docsUrlMetadata.body.org !== data.orgName) {
        return NextResponse.json({ error: "Unauthorized: docs URL does not belong to this org" }, { status: 403 });
    }

    // Verify the docs URL has a linked git repo
    if (!docsUrlMetadata.body.gitUrl) {
        return NextResponse.json({ error: "No repository is linked to this docs site" }, { status: 400 });
    }

    // Verify the linked repo matches the requested repo name
    const parsedGitUrl = parseGitUrl(docsUrlMetadata.body.gitUrl);
    if (parsedGitUrl.repo !== data.repoName) {
        console.error("[add-repo-collaborator] Repo mismatch:", {
            requested: data.repoName,
            actual: parsedGitUrl.repo
        });
        return NextResponse.json({ error: "Repo name does not match the linked repository" }, { status: 403 });
    }

    // Verify the repo owner is in the allowlist (fern-support or fern)
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
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    try {
        const octokitResult = getDemoCreationBotOctokit();
        if (!octokitResult.ok) {
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

        // Add the user as a collaborator
        await octokitResult.octokit.request("PUT /repos/{owner}/{repo}/collaborators/{username}", {
            owner: demoCreationBotOwner,
            repo: data.repoName,
            username: data.githubUsername,
            permission: "push"
        });

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
