import { convert } from "@fern-platform/postman-to-openapi";
import type { Json } from "@fern-platform/supabase";
import { type NextRequest, NextResponse } from "next/server";

import { fetchPostmanCollection } from "@/app/services/postman/api";
import { getPostmanAccessToken } from "@/app/services/postman/jwt";
import { upsertOpenApiSpec } from "@/app/services/postman/openapi-repository";
import { getAppInstallationByTeamId, upsertAppInstallation } from "@/app/services/postman/repository";

import { captureServerEvent, PosthogEventName } from "@/components/posthog/events";
import { getServerSidePosthog } from "@/components/posthog/getServerSidePosthog";
import { validatePostmanAuth } from "../../auth";
import type { PublishCollectionRequest, PublishCollectionResponse } from "../../types";

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 2000;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    let body: PublishCollectionRequest;
    try {
        body = (await request.json()) as PublishCollectionRequest;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.payload) {
        return NextResponse.json({ error: "payload is required" }, { status: 400 });
    }

    const { payload } = body;

    if (!payload.collectionId) {
        return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
    }

    if (!payload.userId || !payload.teamId) {
        return NextResponse.json({ error: "userId and teamId are required" }, { status: 400 });
    }

    let installation = null;
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        try {
            installation = await getAppInstallationByTeamId(payload.teamId);
        } catch (e) {
            console.error(`[postman-api] Error looking up installation for team ${payload.teamId}:`, e);
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
            console.error("[postman-api] Failed to update team info:", e);
        }
    }

    let accessToken: string;
    try {
        accessToken = await getPostmanAccessToken({
            teamId: payload.teamId,
            installationAuthId: installation.app_installation_id,
            sharedSecret: installation.shared_secret
        });
    } catch (e) {
        console.error("[postman-api] Failed to get access token:", e);
        return NextResponse.json({ error: "Failed to generate access token" }, { status: 500 });
    }

    let collection: Record<string, unknown>;
    try {
        collection = await fetchPostmanCollection(accessToken, payload.collectionId);
    } catch (e) {
        console.error("[postman-api] Failed to fetch collection:", e);
        return NextResponse.json({ error: "Failed to fetch collection from Postman" }, { status: 502 });
    }

    try {
        const openApiSpec = convert(collection as Parameters<typeof convert>[0]);
        await upsertOpenApiSpec({
            teamId: payload.teamId,
            userId: payload.userId,
            collectionId: payload.collectionId,
            openApiSpec: openApiSpec as unknown as Json
        });
    } catch (e) {
        console.error("[postman-api] Failed to convert/store OpenAPI spec:", e);
    }

    try {
        const posthog = getServerSidePosthog();
        captureServerEvent(posthog, payload.userId, PosthogEventName.POSTMAN_SPEC_PUBLISHED, {
            userId: payload.userId,
            teamId: payload.teamId,
            collectionId: payload.collectionId
        });
    } catch (e) {
        console.error("[postman-api] Failed to capture PostHog event:", e);
    }

    const response: PublishCollectionResponse = {
        success: true,
        collectionId: payload.collectionId,
        userId: payload.userId,
        teamId: payload.teamId,
        message: "Collection publish initiated",
        collection
    };

    return NextResponse.json<PublishCollectionResponse>(response);
}
