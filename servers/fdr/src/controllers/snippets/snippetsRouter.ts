import { FdrAPI } from "@fern-api/fdr-sdk";
import type {
    EndpointIdentifierSchema,
    SdkRequestSchema,
    Snippet,
    SnippetsByEndpointMethod
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import type { FdrApplication } from "../../app";
import type { DbSnippetsPage } from "../../db/snippets/SnippetsDao";
import { APIResolver } from "./APIResolver";

const parameterPayloadSchema = z.object({
    name: z.string(),
    value: z.unknown()
});

const authPayloadSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearer"), token: z.string() }),
    z.object({ type: z.literal("basic"), username: z.string(), password: z.string() })
]);

const customSnippetPayloadSchema = z.object({
    headers: z.array(parameterPayloadSchema).nullish(),
    pathParameters: z.array(parameterPayloadSchema).nullish(),
    queryParameters: z.array(parameterPayloadSchema).nullish(),
    requestBody: z.unknown().nullish(),
    auth: authPayloadSchema.nullish()
});

function mapFernErrorToORPC(error: unknown): never {
    if (error instanceof ORPCError) {
        throw error;
    }
    if (error instanceof Error) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: error.message });
    }
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Internal Server Error" });
}

export function createSnippetsRouter(app: FdrApplication) {
    const get = os
        .route({ method: "POST", path: "/" })
        .input(
            z.custom<{
                orgId: string | null | undefined;
                apiId: string | null | undefined;
                sdks: z.infer<typeof SdkRequestSchema>[] | null | undefined;
                endpoint: z.infer<typeof EndpointIdentifierSchema>;
                exampleIdentifier: string | null | undefined;
                payload: z.infer<typeof customSnippetPayloadSchema> | null | undefined;
            }>()
        )
        .output(z.custom<Snippet[]>())
        .handler(async ({ input, context }) => {
            try {
                const authorization = (context as { headers: Record<string, string | undefined> }).headers
                    .authorization;
                if (authorization === undefined) {
                    throw new ORPCError("UNAUTHORIZED", { message: "You must be authorized to load snippets" });
                }
                const apiInferrer = new APIResolver(app, authorization);
                const apiInfo = await apiInferrer.resolveApi({
                    orgId: input.orgId as FdrAPI.OrgId | undefined,
                    apiId: input.apiId as FdrAPI.ApiId | undefined
                });
                await app.services.auth.checkOrgHasSnippetsApiAccess({
                    authHeader: authorization,
                    orgId: apiInfo.orgId,
                    failHard: true
                });
                const payload = input.payload;
                if (payload == null) {
                    const response: DbSnippetsPage = await app.dao.snippets().loadSnippetsPage({
                        loadSnippetsInfo: {
                            orgId: apiInfo.orgId,
                            apiId: apiInfo.apiId,
                            endpointIdentifier: {
                                path: FdrAPI.EndpointPathLiteral(input.endpoint.path),
                                method: input.endpoint.method as FdrAPI.HttpMethod,
                                identifierOverride: input.endpoint.identifierOverride ?? undefined
                            },
                            exampleIdentifier: input.exampleIdentifier ?? undefined,
                            sdks: input.sdks as FdrAPI.SdkRequest[] | undefined,
                            page: undefined
                        }
                    });

                    let snippetsForEndpoint;
                    if (input.endpoint.identifierOverride != null) {
                        snippetsForEndpoint = response.snippetsByEndpointId[input.endpoint.identifierOverride];
                    }

                    if (
                        input.endpoint.identifierOverride == null ||
                        snippetsForEndpoint == null ||
                        snippetsForEndpoint.length === 0
                    ) {
                        const snippetsForEndpointPath =
                            response.snippets[FdrAPI.EndpointPathLiteral(input.endpoint.path)];
                        if (snippetsForEndpointPath === undefined) {
                            return [];
                        }
                        const snippetsForEndpointMethod =
                            snippetsForEndpointPath[input.endpoint.method as FdrAPI.HttpMethod];
                        snippetsForEndpoint = snippetsForEndpointMethod ?? [];
                    }
                    return snippetsForEndpoint ?? [];
                } else {
                    try {
                        const snippets: FdrAPI.Snippet[] = [];

                        for (const sdk of input.sdks ?? []) {
                            const endpointSnippetTemplate = await app.dao.snippetTemplates().loadSnippetTemplate({
                                loadSnippetTemplateRequest: {
                                    orgId: apiInfo.orgId,
                                    apiId: apiInfo.apiId,
                                    endpointId: {
                                        path: FdrAPI.EndpointPathLiteral(input.endpoint.path),
                                        method: input.endpoint.method as FdrAPI.HttpMethod,
                                        identifierOverride: input.endpoint.identifierOverride ?? undefined
                                    },
                                    sdk: sdk as FdrAPI.SdkRequest
                                }
                            });
                            if (endpointSnippetTemplate == null) {
                                throw new ORPCError("NOT_FOUND", { message: "Snippet not found" });
                            }
                        }

                        return snippets;
                    } catch (_e) {
                        return [];
                    }
                }
            } catch (e) {
                mapFernErrorToORPC(e);
            }
        });

    const load = os
        .route({ method: "POST", path: "/load" })
        .input(
            z.custom<{
                orgId: string | null | undefined;
                apiId: string | null | undefined;
                sdks: z.infer<typeof SdkRequestSchema>[] | null | undefined;
            }>()
        )
        .output(
            z.custom<{
                next: number | null | undefined;
                snippets: Record<string, SnippetsByEndpointMethod>;
            }>()
        )
        .handler(async ({ input, context }) => {
            try {
                const authorization = (context as { headers: Record<string, string | undefined> }).headers
                    .authorization;
                if (authorization === undefined) {
                    throw new ORPCError("UNAUTHORIZED", { message: "You must be authorized to load snippets" });
                }
                const apiInferrer = new APIResolver(app, authorization);
                const apiInfo = await apiInferrer.resolveApi({
                    orgId: input.orgId as FdrAPI.OrgId | undefined,
                    apiId: input.apiId as FdrAPI.ApiId | undefined
                });
                await app.services.auth.checkOrgHasSnippetsApiAccess({
                    authHeader: authorization,
                    orgId: apiInfo.orgId,
                    failHard: true
                });
                const query = (context as { query: Record<string, string | undefined> }).query;
                const pageParam = query.page;
                const page: number | undefined = pageParam != null ? +pageParam : undefined;
                if (page !== undefined && page <= 0) {
                    throw new ORPCError("BAD_REQUEST", { message: "Query parameter 'page' must be >= 1" });
                }
                const response: DbSnippetsPage = await app.dao.snippets().loadSnippetsPage({
                    loadSnippetsInfo: {
                        orgId: apiInfo.orgId,
                        apiId: apiInfo.apiId,
                        endpointIdentifier: undefined,
                        exampleIdentifier: undefined,
                        sdks: input.sdks as FdrAPI.SdkRequest[] | undefined,
                        page
                    }
                });
                return {
                    next: response.nextPage,
                    snippets: response.snippets
                };
            } catch (e) {
                mapFernErrorToORPC(e);
            }
        });

    return { get, load };
}
