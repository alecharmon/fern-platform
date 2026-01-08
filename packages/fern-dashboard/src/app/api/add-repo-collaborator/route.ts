import { type NextRequest, NextResponse } from "next/server";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddCollaboratorRequest {
    repoName: string;
    githubUsername: string;
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

    if (!data.repoName || !data.githubUsername) {
        return NextResponse.json({ error: "repoName and githubUsername are required" }, { status: 400 });
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
