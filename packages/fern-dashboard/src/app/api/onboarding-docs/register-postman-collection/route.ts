import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";

interface RegisterPostmanCollectionRequest {
    domain: string;
    orgId: string;
    postmanCollectionId: string;
}

/**
 * Registers the Postman collection ID with the docs site in FDR.
 * Called by LoaderScreen after the workflow completes successfully.
 *
 * This fills the gap where `fern generate --docs` registers the docs site in FDR
 * but does NOT pass the postmanCollectionId. This route ensures the collection ID
 * is persisted so the docs site is properly linked to the Postman collection.
 */
export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: RegisterPostmanCollectionRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.domain || !data.orgId || !data.postmanCollectionId) {
        return NextResponse.json({ error: "domain, orgId, and postmanCollectionId are required" }, { status: 400 });
    }

    console.log(
        `[register-postman-collection-fdr] Registering postmanCollectionId=${data.postmanCollectionId} for domain=${data.domain}, orgId=${data.orgId}`
    );

    try {
        const { docsDeployment } = getOrpcFdrClient({ token: session.accessToken });
        await docsDeployment.registerDocsSite({
            domain: data.domain,
            orgId: data.orgId,
            postmanCollectionId: data.postmanCollectionId
        });

        console.log("[register-postman-collection-fdr] Successfully registered postmanCollectionId");
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[register-postman-collection-fdr] Failed to register:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Failed to register collection" },
            { status: 500 }
        );
    }
}
