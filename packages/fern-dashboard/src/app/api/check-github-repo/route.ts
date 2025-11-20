"use server";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import checkGitRepository from "@/app/services/dal/git/checkGitRepository";

const requestSchema = z.object({
    docsSiteUrl: z.string()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getCurrentSession();
        if (session == null) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validatedBody = requestSchema.parse(body);

        const result = await checkGitRepository(validatedBody);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        if (result.exists) {
            return NextResponse.json({
                exists: true,
                gitUrl: result.gitUrl,
                owner: result.owner,
                repoName: result.repoName
            });
        }

        return NextResponse.json({ exists: false });
    } catch (error) {
        console.error("Error in check-github-repo route:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
