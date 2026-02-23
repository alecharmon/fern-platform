import {
    type APIV1Read,
    convertDbAPIDefinitionsToRead,
    convertDbDocsConfigToRead,
    type DocsV1Read,
    DocsV1Write,
    type DocsV2Read
} from "@fern-api/fdr-sdk";
import {
    GetDocsConfigByIdInputSchema,
    GetDocsForUrlInputSchema,
    GetDocsUrlMetadataInputSchema,
    GetDocsUrlMetadataResponseSchema,
    GetPrivateDocsForUrlInputSchema,
    ListAllDocsUrlsInputSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import type { FdrApplication } from "../../../app";
import { Cache } from "../../../Cache";
import { ParsedBaseUrl } from "../../../util/ParsedBaseUrl";

type _DocsV2ReadRef = DocsV2Read.LoadDocsForUrlResponse;

interface GetDocsConfigByIdResponse {
    docsConfig: DocsV1Read.DocsConfig;
    apis: Record<string, APIV1Read.ApiDefinition>;
}

const DOCS_CONFIG_ID_CACHE = new Cache<GetDocsConfigByIdResponse>(100);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createDocsV2ReadRouter(app: FdrApplication) {
    const prepopulateFdrReadS3Bucket = os
        .route({ method: "POST", path: "/prepopulate-s3-bucket" })
        .handler(async ({ context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });

                const allDocsUrls = await app.dao.docsV2().listDocsUrlsUpdatedWithin({
                    days: 500,
                    page: 1,
                    limit: 200
                });

                for (const urlRow of allDocsUrls.urls) {
                    const url = ParsedBaseUrl.parse(urlRow.domain);
                    const docsDefinition = await app.docsDefinitionCache.getDocsForUrl({
                        url: url.toURL()
                    });

                    await app.services.s3.writeLoadDocsForUrlResponse({
                        domain: url.hostname,
                        readDocsDefinition: docsDefinition
                    });
                }

                return undefined;
            } catch (_e) {
                return undefined;
            }
        });

    const getDocsForUrl = os
        .route({ method: "POST", path: "/load-with-url" })
        .input(GetDocsForUrlInputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (e) {
                if (e instanceof ORPCError && e.code === "FORBIDDEN") {
                    if (input.url.includes("[") || input.url.includes("]")) {
                        throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
                    }
                    const parsedUrl = ParsedBaseUrl.parse(input.url);
                    const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(parsedUrl.toURL());
                    if (orgId == null) {
                        throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
                    }
                    await app.services.auth.checkUserBelongsToOrg({
                        authHeader: authorization,
                        orgId
                    });
                } else {
                    throw e;
                }
            }
            if (input.url.includes("[") || input.url.includes("]")) {
                throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
            }
            const parsedUrl = ParsedBaseUrl.parse(input.url);
            const response = await app.docsDefinitionCache.getDocsForUrl({
                url: parsedUrl.toURL(),
                excludeApis: input.excludeApis ?? false
            });
            return response;
        });

    const getPrivateDocsForUrl = os
        .route({ method: "POST", path: "/private/load-with-url" })
        .input(GetPrivateDocsForUrlInputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            const parsedUrl = ParsedBaseUrl.parse(input.url);
            const response = await app.docsDefinitionCache.getDocsForUrl({
                url: parsedUrl.toURL()
            });
            return response;
        });

    const getDocsConfigById = os
        .route({ method: "GET", path: "/{docsConfigId}" })
        .input(GetDocsConfigByIdInputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (e) {
                if (e instanceof ORPCError && e.code === "FORBIDDEN") {
                    const orgId = await app.dao.docsV2().getOrgIdForDocsConfigInstanceId(input.docsConfigId);
                    if (orgId == null) {
                        throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
                    }
                    await app.services.auth.checkUserBelongsToOrg({
                        authHeader: authorization,
                        orgId
                    });
                } else {
                    throw e;
                }
            }

            let docsConfig: GetDocsConfigByIdResponse | undefined = DOCS_CONFIG_ID_CACHE.get(input.docsConfigId);
            if (docsConfig == null) {
                const loadDocsConfigResponse = await app.dao.docsV2().loadDocsConfigByInstanceId(input.docsConfigId);
                if (loadDocsConfigResponse == null) {
                    throw new ORPCError("NOT_FOUND", { message: "Docs definition not found" });
                }
                const apiDefinitions = await app.dao.apis().loadAPIDefinitions(loadDocsConfigResponse.referencedApis);
                docsConfig = {
                    docsConfig: convertDbDocsConfigToRead({
                        dbShape: loadDocsConfigResponse.docsConfig
                    }),
                    apis: convertDbAPIDefinitionsToRead(apiDefinitions)
                };
                DOCS_CONFIG_ID_CACHE.set(input.docsConfigId, {
                    docsConfig: convertDbDocsConfigToRead({
                        dbShape: loadDocsConfigResponse.docsConfig
                    }),
                    apis: convertDbAPIDefinitionsToRead(apiDefinitions)
                });
            }
            return docsConfig;
        });

    const listAllDocsUrls = os
        .route({ method: "GET", path: "/urls/list" })
        .input(ListAllDocsUrlsInputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });

            return await app.dao.docsV2().listAllDocsUrls({
                limit: input.limit,
                page: input.page,
                customOnly: input.custom,
                domainSuffix: app.config.domainSuffix,
                preview: input.preview
            });
        });

    const getDocsUrlMetadata = os
        .route({ method: "POST", path: "/metadata-for-url" })
        .input(GetDocsUrlMetadataInputSchema)
        .output(GetDocsUrlMetadataResponseSchema)
        .handler(async ({ input }) => {
            const parsedUrl = ParsedBaseUrl.parse(input.url);
            const metadata = await app.dao.docsV2().loadDocsMetadata(parsedUrl.toURL());
            if (metadata != null) {
                return {
                    isPreviewUrl: metadata.isPreview,
                    org: metadata.orgId,
                    url: input.url,
                    gitUrl: metadata.gitUrl != null ? DocsV1Write.Url(metadata.gitUrl) : undefined,
                    enableAlgoliaOnPreview: metadata.enableAlgoliaOnPreview
                };
            }
            throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
        });

    const ensureDocsInS3 = os.route({ method: "POST", path: "/ensure-docs-in-s3" }).handler(async () => {
        throw new Error(
            "ensureDocsInS3 endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
        );
    });

    const getDocsFields = os.route({ method: "POST", path: "/load-fields" }).handler(async () => {
        throw new Error(
            "getDocsFields endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
        );
    });

    return {
        prepopulateFdrReadS3Bucket,
        getDocsForUrl,
        getPrivateDocsForUrl,
        getDocsConfigById,
        listAllDocsUrls,
        getDocsUrlMetadata,
        ensureDocsInS3,
        getDocsFields
    };
}
