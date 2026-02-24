import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { triggerWorkflow } from "@/app/services/dal/github/triggerWorkflow";

interface TriggerWorkflowRequest {
    repoName: string;
}

/**
 * Triggers the publish-docs workflow for a repository.
 * Called from the success page after repo creation.
 */
export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: TriggerWorkflowRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.repoName) {
        return NextResponse.json({ error: "repoName is required" }, { status: 400 });
    }

    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
    if (!demoCreationBotOwner) {
        console.error("[trigger-docs-workflow] FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const result = await triggerWorkflow({
        owner: demoCreationBotOwner,
        repoName: data.repoName,
        workflowId: "publish-docs.yml"
    });

    if (result.success) {
        return NextResponse.json({ success: true });
    } else {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }
}
