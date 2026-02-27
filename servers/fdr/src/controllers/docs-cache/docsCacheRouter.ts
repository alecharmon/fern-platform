import type { InvalidateCachedDocsInputSchema } from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import { ParsedBaseUrl } from "../../util/ParsedBaseUrl";

export function createDocsCacheRouter(app: FdrApplication) {
    const invalidate = os
        .route({ method: "POST", path: "/invalidate" })
        .input(z.custom<z.infer<typeof InvalidateCachedDocsInputSchema>>())
        .output(z.custom<void>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            if (authorization == null) {
                throw new ORPCError("UNAUTHORIZED");
            }
            await app.docsDefinitionCache.invalidateCache(ParsedBaseUrl.parse(input.url).toURL());
            return undefined;
        });

    return { invalidate };
}
