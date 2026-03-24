import type { SlugsInputSchema } from "@fern-api/fdr-sdk/orpc-client";
import { os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

export function createSlugsRouter(app: FdrApplication) {
    const getSlugEntries = os
        .route({ method: "POST", path: "/slugs" })
        .input(z.custom<z.infer<typeof SlugsInputSchema>>())
        .output(
            z.custom<{
                entries: Array<{
                    orgId: string;
                    domain: string;
                    basepath: string;
                    slug: string;
                    lastUpdated: string;
                }>;
            }>()
        )
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const url = new URL(`https://${input.domain}${input.basepath ?? ""}`);
            const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url);
            if (orgId == null) {
                return { entries: [] };
            }
            await app.services.auth.checkUserBelongsToOrg({ authHeader: authorization, orgId });

            const entries = await app.dao.slugs().getSlugEntries(input.domain, input.basepath ?? "");
            return {
                entries: entries.map((e) => ({
                    orgId: e.orgId,
                    domain: e.domain,
                    basepath: e.basepath,
                    slug: e.slug,
                    lastUpdated: e.lastUpdated.toISOString()
                }))
            };
        });

    const getMarkdownEntries = os
        .route({ method: "POST", path: "/markdowns" })
        .input(z.custom<z.infer<typeof SlugsInputSchema>>())
        .output(
            z.custom<{
                entries: Array<{
                    orgId: string;
                    domain: string;
                    basepath: string;
                    pageId: string;
                    slug: string;
                    hash: string;
                    lastUpdated: string;
                }>;
            }>()
        )
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const url = new URL(`https://${input.domain}${input.basepath ?? ""}`);
            const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url);
            if (orgId == null) {
                return { entries: [] };
            }
            await app.services.auth.checkUserBelongsToOrg({ authHeader: authorization, orgId });

            const entries = await app.dao.slugs().getMarkdownEntries(input.domain, input.basepath ?? "");
            return {
                entries: entries.map((e) => ({
                    orgId: e.orgId,
                    domain: e.domain,
                    basepath: e.basepath,
                    pageId: e.pageId,
                    slug: e.slug,
                    hash: e.hash,
                    lastUpdated: e.lastUpdated.toISOString()
                }))
            };
        });

    return { getSlugEntries, getMarkdownEntries };
}
