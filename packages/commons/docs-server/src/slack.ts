import { logger } from "@fern-api/ui-core-utils/logger";
import type { ActionsBlock, SectionBlock } from "@slack/types";
import { WebClient } from "@slack/web-api";
import { getEnv } from "@vercel/functions";

import { RateLimiterManager } from "./rate-limiter";

const RATE_LIMITER_MANAGER = RateLimiterManager.getInstance();

type PostToSlackChannel =
    | "#docs-notifs"
    | "#search-notifs"
    | "#dashboard-notifs"
    | "#dashboard-custom-domain-notifs"
    | "#dashboard-feedback"
    | "#dashboard-ftux-notifs"
    | "#dashboard-billing-notifs";

type PostToSlackContext =
    | "default"
    | "mdx-serializer"
    | "turbopuffer-reindex"
    | "algolia-reindex"
    | "org-member-change"
    | "duplicate-account"
    | "custom-domain"
    | "editor-feedback"
    | "docs-onboarding-complete"
    | "billing";

// contexts that should be allowed to post on dev and bypass rate limiting
const alwaysAllowToPost: PostToSlackContext[] = [
    "org-member-change",
    "editor-feedback",
    "docs-onboarding-complete",
    "billing"
];

// contexts that should skip posting deployment logs
const shouldSkipDeploymentLogs: PostToSlackContext[] = [
    "org-member-change",
    "editor-feedback",
    "docs-onboarding-complete",
    "billing"
];

export interface PostToSlackResult {
    success: boolean;
    error?: "no-token" | "dev-environment" | "rate-limited" | "api-error";
}

/**
 * Internal implementation that posts to Slack immediately.
 * Use this when you need to await the Slack notification before continuing.
 */
export async function postToSlackImmediate(
    channel: PostToSlackChannel,
    message: string | (SectionBlock | ActionsBlock)[],
    context: PostToSlackContext = "default",
    thread?: {
        message: string;
        mrkdwn: boolean;
    }
): Promise<PostToSlackResult> {
    logger.debug("posting to engineering notifs:", message, thread);

    if (!process.env.SLACK_TOKEN) {
        logger.warn("SLACK_TOKEN is not configured");
        return { success: false, error: "no-token" };
    }

    const { VERCEL_DEPLOYMENT_ID, VERCEL_ENV } = getEnv();

    const isVercelDev = !VERCEL_ENV || VERCEL_ENV === "development";

    if (isVercelDev && !alwaysAllowToPost.includes(context)) {
        return { success: false, error: "dev-environment" };
    }

    const rateLimiter = RATE_LIMITER_MANAGER.getLimiter(context, 10, 60 * 1000);

    if (!rateLimiter.canMakeRequest() && !alwaysAllowToPost.includes(context)) {
        logger.warn(`Rate limit exceeded for Slack notifications in context: ${context}`);
        return { success: false, error: "rate-limited" };
    }
    rateLimiter.increment();

    try {
        const webClient = new WebClient(process.env.SLACK_TOKEN);
        const result = await webClient.chat.postMessage(
            typeof message === "string"
                ? {
                      channel: channel,
                      text: message
                  }
                : {
                      channel: channel,
                      blocks: message
                  }
        );

        if (result.ts && VERCEL_DEPLOYMENT_ID && !shouldSkipDeploymentLogs.includes(context)) {
            await webClient.chat.postMessage({
                thread_ts: result.ts,
                channel: channel,
                text: `View deployment logs: https://vercel.com/buildwithfern/prod.ferndocs.com/${VERCEL_DEPLOYMENT_ID.slice(4)}/logs`,
                unfurl_links: true
            });
        }

        if (result.ts && thread) {
            await webClient.chat.postMessage({
                channel: channel,
                text: thread.message,
                thread_ts: result.ts,
                mrkdwn: thread.mrkdwn
            });
        }

        return { success: true };
    } catch (error) {
        logger.error("[slack] Error posting to Slack:", error);
        return { success: false, error: "api-error" };
    }
}

/**
 * Posts to Slack using Next.js `after()` to defer execution until after the response is sent.
 * Use this for most cases where you don't need to block on the Slack notification.
 */
export function postToSlack(
    channel: PostToSlackChannel,
    message: string | (SectionBlock | ActionsBlock)[],
    context: PostToSlackContext = "default",
    thread?: {
        message: string;
        mrkdwn: boolean;
    }
) {
    // Execute asynchronously without requiring Next.js request lifecycle helpers.
    return void Promise.resolve().then(() => postToSlackImmediate(channel, message, context, thread));
}
