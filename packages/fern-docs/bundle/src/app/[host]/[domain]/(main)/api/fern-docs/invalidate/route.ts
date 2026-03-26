import { convertResponseToRootNode } from "@fern-api/docs-loader";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { uncachedLoadWithUrl } from "@fern-api/docs-server/loadWithUrl";
import { HEADER_X_FERN_HOST, slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getEdgeFlags } from "@fern-docs/edge-config";
import { waitUntil } from "@vercel/functions";
import { kv } from "@vercel/kv";
import { escapeRegExp } from "es-toolkit/string";
import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { fetchAndDiscard } from "@/utils/fetch-and-discard";
import { createSafeStreamController } from "@/utils/safe-stream-controller";

export const maxDuration = 800;

function extractPureDomain(domainKey: string): string {
    const decoded = decodeURIComponent(domainKey);
    const slashIndex = decoded.indexOf("/");
    return slashIndex === -1 ? decoded : decoded.slice(0, slashIndex);
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function warmPage(
    origin: string,
    pureDomain: string,
    slug: string,
    enqueue: (msg: string) => void
): Promise<boolean> {
    const url = withDefaultProtocol(`${pureDomain}${slugToHref(slug)}`);
    try {
        const result = await fetchAndDiscard(`${origin}${slugToHref(slug)}`, {
            method: "GET",
            headers: { [HEADER_X_FERN_HOST]: pureDomain },
            signal: AbortSignal.timeout(120_000)
        });
        if (result.ok) {
            enqueue(`warmed:${url}\n`);
            return true;
        }
        logger.error(`[invalidate-warm:page] status=${result.status} url=${url}`);
        enqueue(`warm-failed:${url} status=${result.status}\n`);
        return false;
    } catch (e) {
        logger.error(`[invalidate-warm:page] error: url=${url}; error=${JSON.stringify(e)}`);
        enqueue(`warm-failed:${url} error=${escapeRegExp(String(e))}\n`);
        return false;
    }
}

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        throw new Error("invalidation is only available in production");
    }

    const start = performance.now();

    const { host, domain: rawDomain } = await props.params;
    const domain = decodeURIComponent(rawDomain);
    const warm = req.nextUrl.searchParams.get("warm") === "true";

    revalidateTag(domain, { expire: 0 });

    // If warm=true, use waitUntil to keep the function alive
    let resolveWarm: (() => void) | undefined;
    if (warm) {
        const warmPromise = new Promise<void>((resolve) => {
            resolveWarm = resolve;
        });
        waitUntil(warmPromise);
    }

    const stream = new ReadableStream({
        async start(controller) {
            const c = warm ? createSafeStreamController(controller, "[invalidate-warm]") : undefined;
            try {
                const enqueue = (msg: string) => {
                    if (c) {
                        c.enqueue(msg);
                    } else {
                        controller.enqueue(msg);
                    }
                };

                enqueue(`invalidating:${domain}\n`);

                try {
                    await kv.del(domain);
                } catch (e) {
                    logger.error(`[invalidate:enqueue] ${JSON.stringify(e)}`);
                    enqueue(`invalidate-kv-keys-set-failed:error=${escapeRegExp(String(e))}\n`);
                }

                const invalidateEnd = performance.now();
                logger.info(`Invalidation took ${invalidateEnd - start}ms`);
                enqueue(`invalidate-finished:${invalidateEnd - start}ms\n`);

                if (warm) {
                    enqueue(`warming:${domain}\n`);

                    // Revalidate layout to clear full route cache
                    revalidatePath(`/${host}/${encodeURIComponent(domain)}`, "layout");

                    // Wait for invalidations to propagate before visiting pages
                    enqueue(`warm-waiting:7s (propagation)\n`);
                    await delay(7_000);

                    const pureDomain = extractPureDomain(domain);
                    const origin = req.nextUrl.origin;

                    const [docs, edgeFlags] = await Promise.all([
                        uncachedLoadWithUrl(domain),
                        getEdgeFlags(pureDomain)
                    ]);

                    const root = convertResponseToRootNode(docs, edgeFlags);
                    const collector = FernNavigation.NodeCollector.collect(root);
                    const slugs = [...collector.revalidationPageSlugs.unauthedSlugs];

                    enqueue(`warm-total:${slugs.length} pages\n`);

                    let succeeded = 0;
                    let failed = 0;

                    const trackResult = (ok: boolean) => {
                        if (ok) {
                            succeeded++;
                        } else {
                            failed++;
                        }
                    };

                    // Phase 1: warm 1 page, then wait 15 seconds
                    const firstSlug = slugs[0];
                    if (firstSlug != null) {
                        enqueue(`warm-phase:1/3 (1 page)\n`);
                        trackResult(await warmPage(origin, pureDomain, firstSlug, enqueue));

                        if (slugs.length > 1) {
                            enqueue(`warm-waiting:15s\n`);
                            await delay(15_000);
                        }
                    }

                    // Phase 2: warm 1 more page, then wait 6 seconds
                    const secondSlug = slugs[1];
                    if (secondSlug != null) {
                        enqueue(`warm-phase:2/3 (1 page)\n`);
                        trackResult(await warmPage(origin, pureDomain, secondSlug, enqueue));

                        if (slugs.length > 2) {
                            enqueue(`warm-waiting:6s\n`);
                            await delay(6_000);
                        }
                    }

                    // Phase 3: warm all remaining pages, 15 at a time
                    const remainingSlugs = slugs.slice(2);
                    if (remainingSlugs.length > 0) {
                        enqueue(`warm-phase:3/3 (${remainingSlugs.length} pages, 15 concurrent)\n`);
                        const concurrency = 15;
                        for (let i = 0; i < remainingSlugs.length; i += concurrency) {
                            const batch = remainingSlugs.slice(i, i + concurrency);
                            const results = await Promise.all(
                                batch.map((slug) => warmPage(origin, pureDomain, slug, enqueue))
                            );
                            for (const ok of results) {
                                trackResult(ok);
                            }
                        }
                    }

                    const warmEnd = performance.now();
                    enqueue(
                        `warm-finished:${warmEnd - start}ms;succeeded=${succeeded};failed=${failed};total=${slugs.length}\n`
                    );
                }
            } catch (e) {
                logger.error(`[invalidate] ${JSON.stringify(e)}`);
                if (c) {
                    c.enqueue(`invalidate-failed:error=${escapeRegExp(String(e))}\n`);
                } else {
                    controller.enqueue(`invalidate-failed:error=${escapeRegExp(String(e))}\n`);
                }
            } finally {
                if (c) {
                    c.close();
                } else {
                    controller.close();
                }
                resolveWarm?.();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream"
        }
    });
}
