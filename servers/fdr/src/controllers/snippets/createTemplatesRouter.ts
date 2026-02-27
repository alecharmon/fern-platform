import { FdrAPI } from "@fern-api/fdr-sdk";
import type { GetInputSchema, RegisterBatchInputSchema, RegisterInputSchema } from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import { APIResolver } from "./APIResolver";

export function createTemplatesRouter(app: FdrApplication) {
    const register = os
        .route({ method: "POST", path: "/register" })
        .input(z.custom<z.infer<typeof RegisterInputSchema>>())
        .handler(async ({ input }) => {
            const orgId = FdrAPI.OrgId(input.orgId);
            const apiId = FdrAPI.ApiId(input.apiId);
            const api = await app.dao.snippetAPIs().loadSnippetAPI({
                loadSnippetAPIRequest: {
                    orgId,
                    apiName: apiId
                }
            });
            if (api == null) {
                await app.dao.snippetAPIs().createSnippetAPI({
                    apiName: apiId,
                    orgId
                });
            }
            await app.dao.snippetTemplates().storeSnippetTemplate({
                storeSnippetsInfo: {
                    orgId,
                    apiId,
                    apiDefinitionId: FdrAPI.ApiDefinitionId(input.apiDefinitionId),
                    snippets: [input.snippet as unknown as FdrAPI.SnippetRegistryEntry]
                }
            });
        });

    const registerBatch = os
        .route({ method: "POST", path: "/register/batch" })
        .input(z.custom<z.infer<typeof RegisterBatchInputSchema>>())
        .handler(async ({ input }) => {
            const orgId = FdrAPI.OrgId(input.orgId);
            const apiId = FdrAPI.ApiId(input.apiId);
            const api = await app.dao.snippetAPIs().loadSnippetAPI({
                loadSnippetAPIRequest: {
                    orgId,
                    apiName: apiId
                }
            });
            if (api == null) {
                await app.dao.snippetAPIs().createSnippetAPI({
                    apiName: apiId,
                    orgId
                });
            }
            await app.dao.snippetTemplates().storeSnippetTemplate({
                storeSnippetsInfo: {
                    orgId,
                    apiId,
                    apiDefinitionId: FdrAPI.ApiDefinitionId(input.apiDefinitionId),
                    snippets: input.snippets as unknown as FdrAPI.SnippetRegistryEntry[]
                }
            });
        });

    const get = os
        .route({ method: "POST", path: "/get" })
        .input(z.custom<z.infer<typeof GetInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            if (authorization === undefined) {
                throw new ORPCError("UNAUTHORIZED", { message: "You must be authorized to load snippets" });
            }
            const apiInferrer = new APIResolver(app, authorization);
            const apiInfo = await apiInferrer.resolveApi({
                orgId: FdrAPI.OrgId(input.orgId),
                apiId: FdrAPI.ApiId(input.apiId)
            });
            const snippet = await app.dao.snippetTemplates().loadSnippetTemplate({
                loadSnippetTemplateRequest: {
                    orgId: apiInfo.orgId,
                    apiId: apiInfo.apiId,
                    sdk: input.sdk as unknown as FdrAPI.SdkRequest,
                    endpointId: input.endpointId as unknown as FdrAPI.EndpointIdentifier
                }
            });
            if (snippet == null) {
                throw new ORPCError("NOT_FOUND", { message: "The requested snippet could not be found." });
            }
            return snippet;
        });

    return { register, registerBatch, get };
}
