import { getMetadata } from "@fern-api/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import {
    FERN_DOCS_BUILDWITHFERN_COM,
    FERN_DOCS_DEV_BUILDWITHFERN_COM,
    FERN_DOCS_STAGING_BUILDWITHFERN_COM,
    withoutStaging
} from "@fern-api/docs-utils";
import { getEnv } from "@vercel/functions";
import { kv } from "@vercel/kv";
import { uniq } from "es-toolkit/array";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

import { batchQueue } from "@/server/queue";

export async function POST(request: NextRequest) {
    if (isLocal() || isSelfHosted()) {
        throw new Error("production deployment is only available in production");
    }

    try {
        const cdnUri = process.env.NEXT_PUBLIC_CDN_URI;

        if (!cdnUri) {
            console.error(`[deployment-promoted:${request.url}] Undefined CDN URI`);
            notFound();
        }

        const { VERCEL_DEPLOYMENT_ID } = getEnv();

        // if (
        //   request.headers.get("x-vercel-signature") !==
        //   process.env.DEPLOYMENT_PROMOTED_WEBHOOK_SECRET
        // ) {
        //   return new Response("Unauthorized", { status: 401 });
        // }

        console.debug("x-vercel-signature", request.headers.get("x-vercel-signature"));

        let domains: string[] = [];
        try {
            const rawDomains = await kv.smembers(`${cdnUri}:domains`);
            domains = uniq(
                rawDomains
                    // filter out domains that are not production domains
                    .filter(
                        (domain) =>
                            !domain.endsWith(`.${FERN_DOCS_BUILDWITHFERN_COM}`) &&
                            !domain.endsWith(`.${FERN_DOCS_STAGING_BUILDWITHFERN_COM}`) &&
                            !domain.endsWith(`.${FERN_DOCS_DEV_BUILDWITHFERN_COM}`)
                    )
                    .map(withoutStaging)
            ).sort((a, b) => {
                if (a === "alchemy.com") {
                    return -1;
                }
                if (b === "alchemy.com") {
                    return 1;
                }
                return 0;
            });
        } catch (err) {
            console.error(`[deployment-promoted:${request.url}] Error retrieving domains from kv:`, err);
            throw err;
        }

        let settledMetadata;
        try {
            settledMetadata = await Promise.allSettled(
                domains.map(getMetadata({ kvTtl: 0, forceRevalidate: false, cacheKeySuffix: "" }))
            );
        } catch (err) {
            console.error(`[deployment-promoted:${request.url}] Error getting metadata for domains:`, err);
            throw err;
        }

        const rejectedMetadata = settledMetadata.filter((result) => result.status === "rejected");

        if (rejectedMetadata.length > 0) {
            console.error(`Failed to get metadata for ${rejectedMetadata.length} out of ${domains.length} domains`);
            rejectedMetadata.forEach((result) => {
                console.error(result.reason);
            });
        }

        const metadatas = settledMetadata
            .filter((result) => result.status === "fulfilled")
            .map((fulfilled) => (fulfilled as PromiseFulfilledResult<any>).value);

        console.log(`[deployment-promoted] Revalidating ${metadatas.length} domains`);

        try {
            await batchQueue({
                queueName: `domain-promoted.${VERCEL_DEPLOYMENT_ID}`,
                parallelism: 10, // QStash plan has a queue parallelism limit of 10
                endpoint: "/api/fern-docs/revalidate?reindex=false",
                requests: metadatas.map((metadata) => ({
                    host: metadata.domain,
                    domain: metadata.domain,
                    basepath: metadata.basePath,
                    // the deduplication ID avoids duplicate revalidations within the a 15 minute window
                    deduplicationId: `revalidate.${Math.floor(Date.now() / (1000 * 60 * 15))}.${metadata.domain}`
                })),
                method: "GET",
                retries: 1
            });
        } catch (err) {
            console.error(`[deployment-promoted:${request.url}] Error running batchQueue:`, err);
            throw err;
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error(`[deployment-promoted:${request.url}] Error in POST handler:`, error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
