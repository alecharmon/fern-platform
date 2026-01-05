import type { ActionsBlock, SectionBlock } from "@slack/types";
import { WebClient } from "@slack/web-api";
import { getEnv } from "@vercel/functions";
import { after } from "next/server";

import { RateLimiterManager } from "./rate-limiter";

const RATE_LIMITER_MANAGER = RateLimiterManager.getInstance();

type PostToSlackChannel =
    | "#docs-notifs"
    | "#search-notifs"
    | "#dashboard-access-notifs"
    | "#dashboard-notifs"
    | "#dashboard-custom-domain-notifs";

type PostToSlackContext =
    | "default"
    | "mdx-serializer"
    | "turbopuffer-reindex"
    | "algolia-reindex"
    | "request-org-access"
    | "org-member-change"
    | "duplicate-account"
    | "custom-domain";

// contexts that should be allowed to post on dev and bypass rate limiting
const alwaysAllowToPost: PostToSlackContext[] = ["request-org-access", "org-member-change"];

// contexts that should skip posting deployment logs
const shouldSkipDeploymentLogs: PostToSlackContext[] = ["request-org-access", "org-member-change"];

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
): Promise<void> {
    console.log("posting to engineering notifs:", message, thread);

    if (!process.env.SLACK_TOKEN) {
        return;
    }

    const { VERCEL_DEPLOYMENT_ID, VERCEL_ENV } = getEnv();

    const isVercelDev = !VERCEL_ENV || VERCEL_ENV === "development";

    if (isVercelDev && !alwaysAllowToPost.includes(context)) {
        // don't post to Slack on dev, except if context is always allowed
        return;
    }

    // limit the amount of notifications we get at one time for each possible failure
    const rateLimiter = RATE_LIMITER_MANAGER.getLimiter(context, 10, 60 * 1000);

    if (!rateLimiter.canMakeRequest() && !alwaysAllowToPost.includes(context)) {
        console.warn(`Rate limit exceeded for Slack notifications in context: ${context}`);
        // don't post to Slack when rate limit is exceeded, except if context is always allowed
        return;
    }
    rateLimiter.increment();

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
    return after(() => postToSlackImmediate(channel, message, context, thread));
}
