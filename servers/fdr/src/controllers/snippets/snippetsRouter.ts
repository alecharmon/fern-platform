import { FdrAPI } from "@fern-api/fdr-sdk";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import { FernRegistryError } from "../../api/generated/errors/FernRegistryError";
import type { FdrApplication } from "../../app";
import type { DbSnippetsPage } from "../../db/snippets/SnippetsDao";
import { APIResolver } from "./APIResolver";

const sdkRequestSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("typescript"), package: z.string(), version: z.string().optional() }),
    z.object({ type: z.literal("python"), package: z.string(), version: z.string().optional() }),
    z.object({ type: z.literal("go"), githubRepo: z.string(), version: z.string().optional() }),
    z.object({ type: z.literal("ruby"), gem: z.string(), version: z.string().optional() }),
    z.object({
        type: z.literal("java"),
        group: z.string(),
        artifact: z.string(),
        version: z.string().optional()
    }),
    z.object({ type: z.literal("csharp"), package: z.string(), version: z.string().optional() })
]);

const endpointIdentifierSchema = z.object({
    path: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
    identifierOverride: z.string().optional()
});

const parameterPayloadSchema = z.object({
    name: z.string(),
    value: z.unknown()
});

const authPayloadSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("bearer"), token: z.string() }),
    z.object({ type: z.literal("basic"), username: z.string(), password: z.string() })
]);

const customSnippetPayloadSchema = z.object({
    headers: z.array(parameterPayloadSchema).optional(),
    pathParameters: z.array(parameterPayloadSchema).optional(),
    queryParameters: z.array(parameterPayloadSchema).optional(),
    requestBody: z.unknown().optional(),
    auth: authPayloadSchema.optional()
});

function mapFernErrorToORPC(error: unknown): never {
    if (error instanceof ORPCError) {
        throw error;
    }
    if (error instanceof FernRegistryError) {
        const name = error.errorName;
        if (name === "UnauthorizedError" || name === "UserNotInOrgError") {
            throw new ORPCError("UNAUTHORIZED", { message: error.message });
        }
        if (name === "UnavailableError") {
            throw new ORPCError("SERVICE_UNAVAILABLE", { message: error.message });
        }
        if (name === "ApiIdRequiredError" || name === "OrgIdRequiredError" || name === "InvalidPageError") {
            throw new ORPCError("BAD_REQUEST", { message: error.message });
        }
        if (
            name === "OrgIdAndApiIdNotFound" ||
            name === "OrgIdNotFound" ||
            name === "EndpointNotFound" ||
            name === "SdkNotFound" ||
            name === "SnippetTemplateNotFoundError"
        ) {
            throw new ORPCError("NOT_FOUND", { message: error.message });
        }
    }
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Internal Server Error" });
}

export function createSnippetsRouter(app: FdrApplication) {
    const get = os
        .route({ method: "POST", path: "/" })
        .input(
            z.object({
                orgId: z.string().optional(),
                apiId: z.string().optional(),
                sdks: z.array(sdkRequestSchema).optional(),
                endpoint: endpointIdentifierSchema,
                exampleIdentifier: z.string().optional(),
                payload: customSnippetPayloadSchema.optional()
            })
        )
        .output(z.array(z.any()))
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
                                identifierOverride: input.endpoint.identifierOverride
                            },
                            exampleIdentifier: input.exampleIdentifier,
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
                                        identifierOverride: input.endpoint.identifierOverride
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
            z.object({
                orgId: z.string().optional(),
                apiId: z.string().optional(),
                sdks: z.array(sdkRequestSchema).optional()
            })
        )
        .output(
            z.object({
                next: z.number().optional(),
                snippets: z.record(z.string(), z.any())
            })
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
