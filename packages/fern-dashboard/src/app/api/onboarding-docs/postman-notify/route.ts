import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { notifyPostman } from "@/app/services/postman/notifyPostman";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostmanNotifyRequest {
    teamId: string;
    collectionId: string;
    siteUrl: string;
    success: boolean;
    error?: string;
}

export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    let data: PostmanNotifyRequest;
    try {
        data = await req.json();
    } catch {
        return new Response("Invalid request body", { status: 400 });
    }

    if (!data.teamId || !data.collectionId || !data.siteUrl) {
        return new Response("teamId, collectionId, and siteUrl are required", { status: 400 });
    }

    try {
        await notifyPostman({
            teamId: data.teamId,
            collectionId: data.collectionId,
            siteUrl: data.siteUrl,
            success: data.success,
            error: data.error
        });

        return Response.json({ success: true });
    } catch (err) {
        console.error("[postman-notify] Failed to notify Postman:", err);
        return Response.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to notify Postman" },
            { status: 500 }
        );
    }
}
