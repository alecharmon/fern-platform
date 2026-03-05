import type { NextRequest } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { notifyPostmanDeleted } from "@/app/services/postman/notifyPostmanDeleted";
import { getLatestOpenApiSpecByTeamId } from "@/app/services/postman/openapi-repository";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

interface NotifyDeletedRequest {
    organizationId: string;
}

export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    let data: NotifyDeletedRequest;
    try {
        data = await req.json();
    } catch {
        return new Response("Invalid request body", { status: 400 });
    }

    if (!data.organizationId) {
        return new Response("organizationId is required", { status: 400 });
    }

    try {
        const venus = getVenusClient({ token: session.accessToken });
        const orgResponse = await venus.organization.get(data.organizationId);
        const isMember = await venus.organization.isMember(data.organizationId);

        if (!orgResponse.ok) {
            console.error("[postman-notify-deleted] Failed to get organization from Venus:", orgResponse.error);
            return Response.json({ success: false, error: "Failed to get organization" }, { status: 500 });
        }
        if (!isMember.ok || !isMember.body) {
            return new Response("Forbidden", { status: 403 });
        }
        const postmanTeamId = orgResponse.body.postmanTeamId;
        if (!postmanTeamId) {
            console.log(
                `[postman-notify-deleted] Organization ${data.organizationId} has no Postman integration, skipping`
            );
            return Response.json({ success: true, skipped: true });
        }

        const spec = await getLatestOpenApiSpecByTeamId(postmanTeamId);
        if (!spec) {
            console.log(`[postman-notify-deleted] No collection found for Postman team ${postmanTeamId}, skipping`);
            return Response.json({ success: true, skipped: true });
        }

        await notifyPostmanDeleted({
            teamId: postmanTeamId,
            collectionId: spec.collection_id
        });

        return Response.json({ success: true });
    } catch (err) {
        console.error("[postman-notify-deleted] Failed to notify Postman:", err);
        return Response.json(
            { success: false, error: err instanceof Error ? err.message : "Failed to notify Postman" },
            { status: 500 }
        );
    }
}
