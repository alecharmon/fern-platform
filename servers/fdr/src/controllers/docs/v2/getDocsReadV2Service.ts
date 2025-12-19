import { convertDbAPIDefinitionsToRead, convertDbDocsConfigToRead, DocsV1Write } from "@fern-api/fdr-sdk";
import { DocsV2Read, DocsV2ReadService } from "../../../api";
import { UserNotInOrgError } from "../../../api/generated/api";
import { DomainNotRegisteredError } from "../../../api/generated/api/resources/docs/resources/v1/resources/read";
import type { FdrApplication } from "../../../app";
import { Cache } from "../../../Cache";
import { ParsedBaseUrl } from "../../../util/ParsedBaseUrl";

const DOCS_CONFIG_ID_CACHE = new Cache<DocsV2Read.GetDocsConfigByIdResponse>(100);

export function getDocsReadV2Service(app: FdrApplication): DocsV2ReadService {
    return new DocsV2ReadService({
        prepopulateFdrReadS3Bucket: async (req, res) => {
            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: req.headers.authorization,
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

                return await res.send();
            } catch (_e) {}
        },
        getDocsForUrl: async (req, res) => {
            try {
                // if the auth header belongs to fern, return the docs definition
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: req.headers.authorization,
                    orgId: "fern"
                });
            } catch (e) {
                // if the auth header does not belong to fern, check the org id for the docs url, and check if the user belongs to that org
                if (e instanceof UserNotInOrgError) {
                    // do not parse placeholder domain
                    if (req.body.url.includes("[") || req.body.url.includes("]")) {
                        throw new DocsV2Read.DomainNotRegisteredError();
                    }
                    const parsedUrl = ParsedBaseUrl.parse(req.body.url);
                    const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(parsedUrl.toURL());
                    if (orgId == null) {
                        throw new DocsV2Read.DomainNotRegisteredError();
                    }
                    await app.services.auth.checkUserBelongsToOrg({
                        authHeader: req.headers.authorization,
                        orgId
                    });
                }
                throw e;
            }
            // do not parse placeholder domain
            if (req.body.url.includes("[") || req.body.url.includes("]")) {
                throw new DocsV2Read.DomainNotRegisteredError();
            }
            const parsedUrl = ParsedBaseUrl.parse(req.body.url);
            const response = await app.docsDefinitionCache.getDocsForUrl({
                url: parsedUrl.toURL(),
                excludeApis: req.body.excludeApis ?? false
            });
            return res.send(response);
        },
        getPrivateDocsForUrl: async (req, res) => {
            // TODO: start deleting this deprecated endpoint
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: "fern"
            });
            const parsedUrl = ParsedBaseUrl.parse(req.body.url);
            const response = await app.docsDefinitionCache.getDocsForUrl({
                url: parsedUrl.toURL()
            });
            return res.send(response);
        },
        getOrganizationForUrl: async (req, res) => {
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: "fern"
            });
            const parsedUrl = ParsedBaseUrl.parse(req.body.url);
            const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(parsedUrl.toURL());
            if (orgId == null) {
                throw new DocsV2Read.DomainNotRegisteredError();
            }
            return res.send(orgId);
        },
        getDocsConfigById: async (req, res) => {
            try {
                // if the auth header belongs to fern, return the docs definition
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: req.headers.authorization,
                    orgId: "fern"
                });
            } catch (e) {
                // if the auth header does not belong to fern, check the org id for the docs url, and check if the user belongs to that org
                if (e instanceof UserNotInOrgError) {
                    const orgId = await app.dao.docsV2().getOrgIdForDocsConfigInstanceId(req.params.docsConfigId);
                    if (orgId == null) {
                        throw new DocsV2Read.DomainNotRegisteredError();
                    }
                    await app.services.auth.checkUserBelongsToOrg({
                        authHeader: req.headers.authorization,
                        orgId
                    });
                }
                throw e;
            }

            let docsConfig: DocsV2Read.GetDocsConfigByIdResponse | undefined = DOCS_CONFIG_ID_CACHE.get(
                req.params.docsConfigId
            );
            if (docsConfig == null) {
                const loadDocsConfigResponse = await app.dao
                    .docsV2()
                    .loadDocsConfigByInstanceId(req.params.docsConfigId);
                if (loadDocsConfigResponse == null) {
                    throw new DocsV2Read.DocsDefinitionNotFoundError();
                }
                const apiDefinitions = await app.dao.apis().loadAPIDefinitions(loadDocsConfigResponse.referencedApis);
                docsConfig = {
                    docsConfig: convertDbDocsConfigToRead({
                        dbShape: loadDocsConfigResponse.docsConfig
                    }),
                    apis: convertDbAPIDefinitionsToRead(apiDefinitions)
                };
                DOCS_CONFIG_ID_CACHE.set(req.params.docsConfigId, {
                    docsConfig: convertDbDocsConfigToRead({
                        dbShape: loadDocsConfigResponse.docsConfig
                    }),
                    apis: convertDbAPIDefinitionsToRead(apiDefinitions)
                });
            }
            return res.send(docsConfig);
        },
        listAllDocsUrls: async (req, res) => {
            // must be a fern employee
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: "fern"
            });

            return res.send(
                await app.dao.docsV2().listAllDocsUrls({
                    limit: req.query.limit,
                    page: req.query.page,
                    customOnly: req.query.custom,
                    domainSuffix: app.config.domainSuffix,
                    preview: req.query.preview
                })
            );
        },
        getDocsUrlMetadata: async (req, res) => {
            const parsedUrl = ParsedBaseUrl.parse(req.body.url);
            const metadata = await app.dao.docsV2().loadDocsMetadata(parsedUrl.toURL());
            if (metadata != null) {
                return res.send({
                    isPreviewUrl: metadata.isPreview,
                    org: metadata.orgId,
                    url: req.body.url,
                    gitUrl: metadata.gitUrl != null ? DocsV1Write.Url(metadata.gitUrl) : undefined,
                    enableAlgoliaOnPreview: metadata.enableAlgoliaOnPreview
                });
            }
            throw new DomainNotRegisteredError();
        },
        ensureDocsInS3: async (req, res) => {
            // This endpoint is only implemented in the lambda version of the service
            // The FDR service redirects to the lambda endpoint
            throw new Error(
                "ensureDocsInS3 endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            );
        },
        getDocsFields: async (req, res) => {
            // This endpoint is only implemented in the lambda version of the service
            // The FDR service redirects to the lambda endpoint
            throw new Error(
                "getDocsFields endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            );
        }
    });
}
