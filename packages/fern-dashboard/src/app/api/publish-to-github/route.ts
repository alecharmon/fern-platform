"use server";

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

import handler from "./handler";

const requestSchema = z.object({
    orgName: z.string(),
    docsSiteUrl: z.string(),
    docsSiteName: z.string(),
    fernDocsDownloadUrl: z.string()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getCurrentSession();
        if (session == null) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validatedBody = requestSchema.parse(body);

        const result = await handler(validatedBody);

        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error("Error in publish-to-github route:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid request data", details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
