import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { decodeAuthContextFromParams } from "@fern-api/docs-utils";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { logger } from "@fern-api/ui-core-utils/logger";
import type { Metadata } from "next/types";
import RootPage from "@/app/page";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";
import { runAsyncSpan } from "@/server/tracing";

export const dynamic = "force-static";
export const revalidate = false;

export default async function RolesPage({
    params
}: {
    params: Promise<{
        host: string;
        domain: string;
        requiresLogin: string;
        isLoggedIn: string;
        roles: string;
        slug: string;
    }>;
}) {
    const { host, domain, slug, ...authParams } = await params;
    const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);
    const rid = `${domain}-${slug}-${Date.now().toString(36).slice(-5)}`;
    logger.debug(
        `[ROUTE:${rid}] RolesPage start - domain: ${domain}, slug: ${slug}, host: ${host}, roles: ${authParams.roles}, isLoggedIn: ${isLoggedIn}, requiresLogin: ${requiresLogin}`
    );

    if (slug === "index.html") {
        logger.debug(`[ROUTE:${rid}] Returning RootPage for index.html`);
        return <RootPage />;
    }

    const loaderStart = Date.now();
    const loader = await createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin });
    const loaderDuration = Date.now() - loaderStart;
    logger.debug(`[ROUTE:${rid}] createCachedDocsLoader done in ${loaderDuration}ms`);

    const finalSlug = slugjoin(slug);
    logger.info(`[404 ISSUE] RolesPage: host="${host}", domain="${domain}", rawSlug="${slug}", finalSlug="${finalSlug}"`);

    const sharedPageStart = Date.now();
    const result = await (<SharedPage loader={loader} slug={finalSlug} />);
    const sharedPageDuration = Date.now() - sharedPageStart;
    logger.debug(`[ROUTE:${rid}] SharedPage done in ${sharedPageDuration}ms`);

    return result;
}

export async function generateMetadata({
    params
}: {
    params: Promise<{
        host: string;
        domain: string;
        requiresLogin: string;
        isLoggedIn: string;
        roles: string;
        slug: string;
    }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.roles.generateMetadata", async (span) => {
        const { host, domain, slug, ...authParams } = await params;
        const { roles, isLoggedIn, requiresLogin } = decodeAuthContextFromParams(authParams);
        span.setAttributes({
            "fern.docs.host": host,
            "fern.docs.domain": domain,
            "fern.docs.slug": slug,
            "fern.docs.roles": authParams.roles,
            "fern.docs.isLoggedIn": String(isLoggedIn),
            "fern.docs.requiresLogin": String(requiresLogin)
        });
        const loader = await runAsyncSpan(
            "route.roles.createCachedDocsLoader",
            () => createCachedDocsLoader(host, domain, undefined, { roles, isLoggedIn, requiresLogin }),
            {
                "fern.docs.domain": domain
            }
        );
        return generateMetadataFromPage({ loader, slug: slugjoin(slug) });
    });
}
