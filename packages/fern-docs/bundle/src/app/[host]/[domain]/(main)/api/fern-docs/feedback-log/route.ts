import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { logger } from "@fern-api/ui-core-utils/logger";
import { type NextRequest, NextResponse } from "next/server";

const SELF_HOSTED_FEEDBACK_LOG_PREFIX = "[fern-docs-feedback]";

const FEEDBACK_EVENTS = new Set([
    "feedback_voted",
    "feedback_submitted",
    "code_block_feedback_submitted",
    "code_block_feedback_opened"
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
    if (!isSelfHosted()) {
        return NextResponse.json({ error: "Not available" }, { status: 404 });
    }

    try {
        const body = await req.json();

        const { event, properties } = body as {
            event?: string;
            properties?: Record<string, unknown>;
        };

        if (!event || !FEEDBACK_EVENTS.has(event)) {
            return NextResponse.json({ error: "Invalid event" }, { status: 400 });
        }

        const payload = {
            event,
            timestamp: new Date().toISOString(),
            ...(properties != null ? { properties } : {})
        };

        logger.info(`${SELF_HOSTED_FEEDBACK_LOG_PREFIX} ${JSON.stringify(payload)}`);

        return NextResponse.json({ ok: true });
    } catch (e) {
        logger.error("[feedback-log] Failed to process request:", e);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
