import { convertDocsDefinitionToDb, DocsV1Write, type DocsV2Write, type FdrAPI } from "@fern-api/fdr-sdk";
import type {
    AlgoliaDomainInputSchema,
    DeleteDocsSiteInputSchema,
    FinishDocsRegisterV2InputSchema,
    ListAlgoliaPreviewWhitelistResponseSchema,
    SetDocsUrlMetadataInputSchema,
    SetIsArchivedInputSchema,
    StartDocsPreviewRegisterInputSchema,
    StartDocsRegisterV2InputSchema,
    TransferOwnershipInputSchema
} from "@fern-api/fdr-sdk/orpc-client";

import { ORPCError, os } from "@orpc/server";
import { AuthType } from "@prisma/client";
import urlJoin from "url-join";
import { v4 as uuidv4 } from "uuid";
import * as z from "zod";

import type { FdrApplication } from "../../../app";

function rethrowAsORPCError(error: unknown): never {
    if (error instanceof ORPCError) {
        throw error;
    }
    if (error instanceof Error) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: error.message });
    }
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Internal Server Error" });
}

import type { S3DocsFileInfo } from "../../../services/s3";
import { ParsedBaseUrl } from "../../../util/ParsedBaseUrl";

export interface DocsRegistrationInfo {
    fernUrl: ParsedBaseUrl;
    customUrls: ParsedBaseUrl[];
    orgId: FdrAPI.OrgId;
    s3FileInfos: Record<DocsV1Write.FilePath, S3DocsFileInfo>;
    isPreview: boolean;
    authType: AuthType;
    deploymentId?: string;
}

function pathnameIsMalformed(pathname: string): boolean {
    if (pathname === "" || pathname === "/") {
        return false;
    }
    if (!/^.*([a-z0-9]).*$/.test(pathname)) {
        // does the pathname only contain special characters?
        return true;
    }
    return false;
}

function truncateDomainName({
    orgId,
    docsRegistrationId,
    domainSuffix
}: {
    orgId: string;
    docsRegistrationId: string;
    domainSuffix: string;
}): string {
    const subdomainLimit = 62;
    const fullDomain = `${orgId}-preview-${docsRegistrationId}.${domainSuffix}`;

    if (fullDomain.length <= subdomainLimit) {
        return fullDomain;
    }

    const prefix = `${orgId}-preview-`;
    const suffix = `.${domainSuffix}`;
    const availableSpace = subdomainLimit - prefix.length;

    // keep 8 characters of obscurity for security
    const minRegistrationIdLength = 8;
    if (availableSpace < minRegistrationIdLength) {
        throw new Error(`Organization name "${orgId}" is too long to fit within ${subdomainLimit} character limit`);
    }

    const truncatedRegistrationId = docsRegistrationId.slice(0, availableSpace);
    const cleanRegistrationId = truncatedRegistrationId.replace(/-+$/, "");
    return `${prefix}${cleanRegistrationId}${suffix}`;
}

function validateAndParseFernDomainUrl({ app, url }: { app: FdrApplication; url: string }): ParsedBaseUrl {
    const baseUrl = ParsedBaseUrl.parse(url);
    if (baseUrl.path != null && pathnameIsMalformed(baseUrl.path)) {
        throw new ORPCError("BAD_REQUEST", {
            message: `Domain URL is malformed: https://${baseUrl.hostname + baseUrl.path}`
        });
    }
    if (!baseUrl.hostname.endsWith(app.config.domainSuffix)) {
        throw new ORPCError("BAD_REQUEST", { message: "Invalid custom domain" });
    }
    return baseUrl;
}

function parseCustomDomainUrls({ customUrls }: { customUrls: string[] }): ParsedBaseUrl[] {
    const parsedUrls: ParsedBaseUrl[] = [];
    for (const customUrl of customUrls) {
        const baseUrl = ParsedBaseUrl.parse(customUrl);
        parsedUrls.push(baseUrl);
    }
    return parsedUrls;
}

export function createDocsV2WriteRouter(app: FdrApplication) {
    const startDocsRegister = os
        .route({ method: "POST", path: "/v2/init" })
        .input(z.custom<z.infer<typeof StartDocsRegisterV2InputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            app.logger.debug(`[startDocsRegister] Starting for org=${input.orgId}, domain=${input.domain}`);

            app.logger.debug(`[startDocsRegister] Checking user belongs to org...`);
            await app.services.auth
                .checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: input.orgId
                })
                .catch(rethrowAsORPCError);
            app.logger.debug(`[startDocsRegister] Auth check passed`);

            app.logger.debug(`[startDocsRegister] Validating domain URL...`);
            const fernUrl = validateAndParseFernDomainUrl({
                app,
                url: input.domain
            });
            const customUrls = parseCustomDomainUrls({
                customUrls: input.customDomains
            });
            app.logger.debug(`[startDocsRegister] Domain validated: ${fernUrl.getFullUrl()}`);

            const shouldCheckCliPermission =
                app.config.cliPermissionCheckOrgIds === "*" || app.config.cliPermissionCheckOrgIds.has(input.orgId);
            if (shouldCheckCliPermission) {
                app.logger.debug(`[startDocsRegister] Checking CLI permission...`);
                const existingDocsOrgId = await app.dao.docsV2().getOrgIdForDocsUrl(fernUrl.toURL());
                const isExistingSite = existingDocsOrgId != null;

                await app.services.auth
                    .checkUserHasCliPermission({
                        authHeader: authorization,
                        orgId: input.orgId,
                        docsUrl: isExistingSite ? fernUrl.getFullUrl() : undefined
                    })
                    .catch(rethrowAsORPCError);
                app.logger.debug(`[startDocsRegister] CLI permission check passed`);
            }

            app.logger.debug(`[startDocsRegister] Checking domain ownership...`);
            const { allDomainsOwned: hasOwnership, unownedDomains } = await app.dao
                .docsV2()
                .checkDomainsDontBelongToAnotherOrg(
                    [fernUrl, ...customUrls].map((url) => url.getFullUrl()),
                    input.orgId
                );
            if (!hasOwnership) {
                throw new ORPCError("FORBIDDEN", {
                    message: `The following domains belong to another organization: ${unownedDomains.join(", ")}`
                });
            }
            app.logger.debug(`[startDocsRegister] Domain ownership verified`);

            if (app.entitlements) {
                app.logger.debug(`[startDocsRegister] Checking entitlements...`);

                // docs_sites limit check
                const existingOrgId = await app.dao.docsV2().getOrgIdForDocsUrl(fernUrl.toURL());
                const isExistingSite = existingOrgId === input.orgId;
                const siteChecker = app.entitlements.for(input.orgId, "docs_sites");

                const billingUrl = `https://dashboard.buildwithfern.com/${input.orgId}/billing`;

                if (isExistingSite) {
                    if (!(await siteChecker.isEntitled())) {
                        throw new ORPCError("FORBIDDEN", {
                            message: `Your plan does not include documentation sites. Please visit billing page to upgrade: ${billingUrl}`
                        });
                    }
                } else {
                    if (!(await siteChecker.canCreate(1))) {
                        throw new ORPCError("FORBIDDEN", {
                            message: `Docs site limit reached. Upgrade your plan to create additional sites: ${billingUrl}`
                        });
                    }
                }

                // custom_domain_subpath check
                const hasSubpath = [fernUrl, ...customUrls].some((url) => url.path != null);
                if (hasSubpath) {
                    const subpathEntitled = await app.entitlements
                        .for(input.orgId, "custom_domain_subpath")
                        .isEntitled();
                    if (!subpathEntitled) {
                        throw new ORPCError("FORBIDDEN", {
                            message: `Custom domain subpaths require a Team plan or higher. Please visit billing page to upgrade: ${billingUrl}`
                        });
                    }
                }

                app.logger.debug(`[startDocsRegister] Entitlement checks passed`);
            }

            const docsRegistrationId = DocsV1Write.DocsRegistrationId(uuidv4());
            app.logger.debug(
                `[startDocsRegister] Getting presigned URLs for ${input.filepaths.length} files, ${input.images?.length ?? 0} images...`
            );
            const { fileInfos, skippedFiles } = await app.services.s3.getPresignedDocsAssetsUploadUrls({
                domain: input.domain,
                filepaths: input.filepaths as DocsV2Write.FilePathInput[],
                images: input.images ?? [],
                isPrivate: input.authConfig?.type === "private"
            });
            app.logger.debug(
                `[startDocsRegister] Got ${Object.keys(fileInfos).length} presigned URLs, ${skippedFiles.length} skipped`
            );

            app.logger.debug(`[startDocsRegister] Sending Slack notification...`);
            await app.services.slack.notifyGeneratedDocs({
                orgId: input.orgId,
                urls: [fernUrl.toURL().toString(), ...customUrls.map((url) => url.toURL().toString())]
            });
            app.logger.debug(`[startDocsRegister] Slack notification sent`);

            app.logger.debug(`[startDocsRegister] Registering docs site and creating deployment...`);
            await app.dao.docsSite().registerDocsSite({
                domain: fernUrl.hostname,
                orgId: input.orgId,
                basepath: fernUrl.path
            });
            const deploymentId = await app.dao.docsSite().createDeployment({
                domain: fernUrl.hostname,
                orgId: input.orgId,
                basepath: fernUrl.path
            });
            app.logger.debug(`[startDocsRegister] Deployment created: ${deploymentId}`);

            app.logger.debug(`[startDocsRegister] Storing registration...`);
            await app.dao.docsRegistration().storeDocsRegistrationById(docsRegistrationId, {
                fernUrl,
                customUrls,
                orgId: input.orgId as FdrAPI.OrgId,
                s3FileInfos: fileInfos,
                isPreview: false,
                authType: input.authConfig?.type === "private" ? AuthType.WORKOS_SSO : AuthType.PUBLIC,
                deploymentId
            });
            app.logger.debug(`[startDocsRegister] Registration stored`);

            return {
                docsRegistrationId,
                uploadUrls: Object.fromEntries(
                    Object.entries(fileInfos).map(([filepath, fileInfo]) => {
                        return [filepath, fileInfo.presignedUrl];
                    })
                ),
                skippedFiles
            };
        });

    const startDocsPreviewRegister = os
        .route({ method: "POST", path: "/preview/init" })
        .input(z.custom<z.infer<typeof StartDocsPreviewRegisterInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });
            const docsRegistrationId = DocsV1Write.DocsRegistrationId(uuidv4());

            let truncatedDomain: string;
            try {
                truncatedDomain = truncateDomainName({
                    orgId: input.orgId,
                    docsRegistrationId,
                    domainSuffix: app.config.domainSuffix
                });
            } catch (error) {
                if (error instanceof Error && error.message.includes("Organization name")) {
                    throw new ORPCError("BAD_REQUEST", {
                        message:
                            "Organization name is too long to generate a valid secure preview link. Shorten organization name and try again."
                    });
                }
                throw error;
            }

            const fernUrl = ParsedBaseUrl.parse(urlJoin(truncatedDomain, input.basePath ?? ""));
            const { fileInfos, skippedFiles } = await app.services.s3.getPresignedDocsAssetsUploadUrls({
                domain: fernUrl.hostname,
                filepaths: input.filepaths as DocsV2Write.FilePathInput[],
                images: input.images ?? [],
                isPrivate: input.authConfig?.type === "private"
            });
            await app.dao.docsSite().registerDocsSite({
                domain: fernUrl.hostname,
                orgId: input.orgId,
                basepath: fernUrl.path,
                previewUrl: `https://${fernUrl.getFullUrl()}`
            });
            const deploymentId = await app.dao.docsSite().createDeployment({
                domain: fernUrl.hostname,
                orgId: input.orgId,
                basepath: fernUrl.path,
                previewUrl: `https://${fernUrl.getFullUrl()}`
            });

            await app.dao.docsRegistration().storeDocsRegistrationById(docsRegistrationId, {
                fernUrl,
                customUrls: [],
                orgId: input.orgId as FdrAPI.OrgId,
                s3FileInfos: fileInfos,
                isPreview: true,
                authType: input.authConfig?.type === "private" ? AuthType.WORKOS_SSO : AuthType.PUBLIC,
                deploymentId
            });

            return {
                docsRegistrationId,
                uploadUrls: Object.fromEntries(
                    Object.entries(fileInfos).map(([filepath, fileInfo]) => {
                        return [filepath, fileInfo.presignedUrl];
                    })
                ),
                skippedFiles,
                previewUrl: `https://${fernUrl.getFullUrl()}`
            };
        });

    const finishDocsRegister = os
        .route({ method: "POST", path: "/register/{docsRegistrationId}" })
        .input(z.custom<z.infer<typeof FinishDocsRegisterV2InputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const docsRegistrationInfo = await app.dao
                .docsRegistration()
                .getDocsRegistrationById(DocsV1Write.DocsRegistrationId(input.docsRegistrationId));
            if (docsRegistrationInfo == null) {
                throw new ORPCError("NOT_FOUND", { message: "Docs registration ID not found" });
            }

            if (authorization == null) {
                throw new ORPCError("UNAUTHORIZED", { message: "Authorization header was not specified" });
            }
            const authHeader = authorization;

            try {
                app.logger.debug(`[${docsRegistrationInfo.fernUrl.getFullUrl()}] Called finishDocsRegister`);
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: docsRegistrationInfo.orgId
                });

                if (input.libraryDocs != null) {
                    app.logger.warn(
                        `[${docsRegistrationInfo.fernUrl.getFullUrl()}] libraryDocs field in finishDocsRegister is deprecated and ignored. Use \`fern docs md generate\` for client-side library docs generation.`
                    );
                }

                app.logger.debug(`[${docsRegistrationInfo.fernUrl.getFullUrl()}] Transforming Docs Definition to DB`);
                const dbDocsDefinition = convertDocsDefinitionToDb({
                    writeShape: input.docsDefinition,
                    files: docsRegistrationInfo.s3FileInfos
                });

                await app.docsDefinitionCache.storeDocsForUrl({
                    docsRegistrationInfo,
                    dbDocsDefinition,
                    excludeApis: input.excludeApis ?? false
                });

                const urls = [docsRegistrationInfo.fernUrl, ...docsRegistrationInfo.customUrls];

                for (const url of urls) {
                    try {
                        const basepath = input.basepathAware === true ? (url.path ?? undefined) : undefined;
                        app.logger.info(
                            `[finishDocsRegister] Writing S3 docs for domain=${url.hostname}${basepath != null ? `, basepath=${basepath} (basepathAware=true)` : ", no basepath"}`
                        );

                        const response = await app.docsDefinitionCache.getDocsForUrl({
                            url: url.toURL(),
                            excludeApis: input.excludeApis ?? false
                        });

                        await app.services.s3.writeLoadDocsForUrlResponse({
                            domain: url.hostname,
                            basepath,
                            readDocsDefinition: response
                        });

                        app.logger.info(
                            `[finishDocsRegister] Successfully wrote S3 docs for domain=${url.hostname}${basepath != null ? `, basepath=${basepath}` : ""}`
                        );

                        if (basepath != null) {
                            try {
                                await app.services.basepathRoutes.addBasepathRoute({
                                    hostname: url.hostname,
                                    basepath
                                });
                            } catch (e) {
                                app.logger.error(
                                    `[finishDocsRegister] Failed to add basepath route to KV for domain=${url.hostname}, basepath=${basepath}`,
                                    e
                                );
                            }
                        }
                    } catch (e) {
                        app.logger.error(`Error while trying to write DB docs definition for ${url.getFullUrl()}`, e);
                    }
                }

                try {
                    await Promise.all(
                        urls.map(async (baseUrl) => {
                            const results = await app.services.revalidator.revalidate({
                                baseUrl,
                                app,
                                authHeader
                            });
                            if (results.failed.length === 0 && !results.revalidationFailed) {
                                app.logger.info(`Successfully revalidated ${results.successful.length} paths.`);
                            } else {
                                await app.services.slack.notifyFailedToRevalidatePaths({
                                    domain: baseUrl.getFullUrl(),
                                    paths: results
                                });
                            }
                        })
                    );
                } catch (e) {
                    app.logger.error(`Error while trying to revalidate docs for ${docsRegistrationInfo.fernUrl}`, e);
                    await app.services.slack.notifyFailedToRegisterDocs({
                        domain: docsRegistrationInfo.fernUrl.getFullUrl(),
                        err: e
                    });
                    throw e;
                }

                app.logger.debug(`[finishDocsRegister] Updating deployment status to LIVE...`);
                if (docsRegistrationInfo.deploymentId != null) {
                    await app.dao.docsSite().updateDeploymentStatus(docsRegistrationInfo.deploymentId, "LIVE");
                    await app.dao
                        .docsSite()
                        .setDocsStatus(
                            docsRegistrationInfo.fernUrl.hostname,
                            docsRegistrationInfo.orgId,
                            docsRegistrationInfo.fernUrl.path,
                            "LIVE"
                        );
                }

                return undefined;
            } catch (e) {
                app.logger.error(`Error while trying to register docs for ${docsRegistrationInfo.fernUrl}`, e);
                await app.services.slack.notifyFailedToRegisterDocs({
                    domain: docsRegistrationInfo.fernUrl.getFullUrl(),
                    err: e
                });

                try {
                    if (docsRegistrationInfo.deploymentId != null) {
                        await app.dao.docsSite().updateDeploymentStatus(docsRegistrationInfo.deploymentId, "ERROR");
                        await app.dao
                            .docsSite()
                            .setDocsStatus(
                                docsRegistrationInfo.fernUrl.hostname,
                                docsRegistrationInfo.orgId,
                                docsRegistrationInfo.fernUrl.path,
                                "ERROR"
                            );
                    }
                } catch (deploymentError) {
                    app.logger.error(
                        `Failed to update deployment status to ERROR for ${docsRegistrationInfo.fernUrl.getFullUrl()}`,
                        deploymentError
                    );
                }

                throw e;
            }
        });

    const transferOwnershipOfDomain = os
        .route({ method: "POST", path: "/transfer-ownership" })
        .input(z.custom<z.infer<typeof TransferOwnershipInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });

            const parsedUrl = ParsedBaseUrl.parse(input.domain);

            await app.dao.docsV2().transferDomainOwner({
                domain: parsedUrl.getFullUrl(),
                toOrgId: input.toOrgId
            });

            return undefined;
        });

    const setIsArchived = os
        .route({ method: "POST", path: "/set-is-archived" })
        .input(z.custom<z.infer<typeof SetIsArchivedInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const url = ParsedBaseUrl.parse(input.url);
            const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url.toURL());
            if (orgId == null) {
                throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
            }

            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId
            });

            await app.dao.docsV2().setIsDocsDefinitionArchived({
                url,
                isArchived: input.isArchived
            });

            return undefined;
        });

    const setDocsUrlMetadata = os
        .route({ method: "POST", path: "/set-metadata-for-url" })
        .input(z.custom<z.infer<typeof SetDocsUrlMetadataInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const url = ParsedBaseUrl.parse(input.url);
            const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url.toURL());
            if (orgId == null) {
                throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
            }

            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId
            });

            await app.dao.docsV2().setDocsMetadata({
                url,
                metadata: {
                    githubUrl: input.githubUrl ?? undefined
                }
            });

            return undefined;
        });

    const addAlgoliaPreviewWhitelistEntry = os
        .route({ method: "POST", path: "/algolia-preview-whitelist/add" })
        .input(z.custom<z.infer<typeof AlgoliaDomainInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });

            await app.dao.docsV2().addAlgoliaPreviewWhitelistEntry(input.domain);

            return undefined;
        });

    const removeAlgoliaPreviewWhitelistEntry = os
        .route({ method: "POST", path: "/algolia-preview-whitelist/remove" })
        .input(z.custom<z.infer<typeof AlgoliaDomainInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });

            await app.dao.docsV2().removeAlgoliaPreviewWhitelistEntry(input.domain);

            return undefined;
        });

    const listAlgoliaPreviewWhitelist = os
        .route({ method: "GET", path: "/algolia-preview-whitelist/list" })
        .output(z.custom<z.infer<typeof ListAlgoliaPreviewWhitelistResponseSchema>>())
        .handler(async ({ context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });

            const domains = await app.dao.docsV2().listAlgoliaPreviewWhitelist();

            return { domains };
        });

    const deleteDocsSite = os
        .route({ method: "POST", path: "/delete" })
        .input(z.custom<z.infer<typeof DeleteDocsSiteInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            const url = ParsedBaseUrl.parse(input.url);

            const docsMetadata = await app.dao.docsV2().loadDocsMetadata(url.toURL());
            if (docsMetadata == null) {
                throw new ORPCError("NOT_FOUND", { message: "Domain not registered" });
            }

            if (!docsMetadata.isPreview) {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot delete non-preview site" });
            }

            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: docsMetadata.orgId
            });

            app.logger.info(`Deleting preview docs site for ${url.getFullUrl()}`);

            const domain = url.hostname;
            const { deletedCount } = await app.services.s3.deleteDocsAssetsByDomain({ domain });
            app.logger.info(`Deleted ${deletedCount} S3 objects for domain ${domain}`);

            await app.dao.docsV2().deleteDocsSite({ url });

            if (!app.config.localModeOverride) {
                try {
                    const invalidateUrl = `https://${url.getFullUrl()}/api/fern-docs/invalidate`;
                    app.logger.info(`Invalidating Vercel cache at ${invalidateUrl}`);
                    const response = await fetch(invalidateUrl);
                    if (!response.ok) {
                        app.logger.warn(
                            `Failed to invalidate Vercel cache for ${url.getFullUrl()}: ${response.status} ${response.statusText}`
                        );
                    } else {
                        app.logger.info(`Successfully invalidated Vercel cache for ${url.getFullUrl()}`);
                    }
                } catch (e) {
                    app.logger.warn(`Error invalidating Vercel cache for ${url.getFullUrl()}`, e);
                }
            }

            return undefined;
        });

    return {
        startDocsRegister,
        startDocsPreviewRegister,
        finishDocsRegister,
        transferOwnershipOfDomain,
        setIsArchived,
        setDocsUrlMetadata,
        addAlgoliaPreviewWhitelistEntry,
        removeAlgoliaPreviewWhitelistEntry,
        listAlgoliaPreviewWhitelist,
        deleteDocsSite
    };
}
