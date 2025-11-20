"use server";

import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import transferGitRepository from "@/app/services/dal/git/transferGitRepository";

const requestSchema = z.object({
    orgName: z.string(),
    currentOwner: z.string(),
    repoName: z.string(),
    newOwner: z.string()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getCurrentSession();
        if (session == null) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validatedBody = requestSchema.parse(body);

        const result = await transferGitRepository(validatedBody);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ newRepoUrl: result.newRepoUrl });
    } catch (error) {
        console.error("Error in transfer-github-repo route:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
