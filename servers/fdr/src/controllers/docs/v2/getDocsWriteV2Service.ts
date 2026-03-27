import {
    convertDocsDefinitionToDb,
    DocsV1Write,
    type DocsV2Write,
    type FdrAPI,
    FernNavigation
} from "@fern-api/fdr-sdk";
import { utils as navigationUtils } from "@fern-api/fdr-sdk/navigation";
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
import { AuthType, type Prisma } from "@prisma/client";
import { createHash } from "crypto";
import urlJoin from "url-join";
import { v4 as uuidv4 } from "uuid";
import * as z from "zod";

import type { FdrApplication } from "../../../app";
import { DocsSitePublishedBuilder } from "../../../services/posthog";
import { normalizeMarkdownForHashing } from "./normalizeMarkdownForHashing";

function rethrowAsORPCError(error: unknown): never {
    if (error instanceof ORPCError) {
        throw error;
    }
    if (error instanceof Error) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: error.message });
    }
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Internal Server Error" });
}

import type { UpsertMarkdownParams } from "../../../db/slugs/SlugsDao";
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

/**
 * Sanitizes a preview ID to be a valid DNS subdomain label.
 * This MUST match the client-side sanitizePreviewId in the CLI.
 */
function sanitizePreviewId(id: string): string {
    const sanitized = id
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "");
    if (sanitized.length === 0) {
        return "default";
    }
    return sanitized;
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

/**
 * Minimum CLI version that supports 409 conflict responses for concurrent publishing.
 * Only enforce the publishing lock when the CLI reports a version >= this value.
 */
const MIN_CLI_VERSION_FOR_CONFLICT_CHECK = "4.25.0";

/** Ignore deployments stuck in PUBLISHING for longer than this (in ms). */
const PUBLISHING_STALENESS_TIMEOUT_MS = 15 * 60 * 1000;

function cliVersionSupportsConflictCheck(cliVersion: string | null | undefined): boolean {
    if (cliVersion == null || cliVersion === "") {
        return false;
    }
    const parts = cliVersion.split(".").map(Number);
    const minParts = MIN_CLI_VERSION_FOR_CONFLICT_CHECK.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
        const current = parts[i] ?? 0;
        const minimum = minParts[i] ?? 0;
        if (current > minimum) {
            return true;
        }
        if (current < minimum) {
            return false;
        }
    }
    return true;
}

function parseCustomDomainUrls({ customUrls }: { customUrls: string[] }): ParsedBaseUrl[] {
    const parsedUrls: ParsedBaseUrl[] = [];
    for (const customUrl of customUrls) {
        const baseUrl = ParsedBaseUrl.parse(customUrl);
        parsedUrls.push(baseUrl);
    }
    return parsedUrls;
}

export { normalizeMarkdownForHashing } from "./normalizeMarkdownForHashing";

async function updateMarkdownEntries(
    app: FdrApplication,
    docsRegistrationInfo: DocsRegistrationInfo,
    dbDocsDefinition: ReturnType<typeof convertDocsDefinitionToDb>
): Promise<void> {
    const domain = docsRegistrationInfo.fernUrl.hostname;
    const basepath = docsRegistrationInfo.fernUrl.path ?? "";
    const orgId = docsRegistrationInfo.orgId;

    // Build pageId → URL slug mapping from the navigation tree
    let pageIdToSlug = new Map<string, string>();
    const rootNode = dbDocsDefinition.config.root as FernNavigation.V1.RootNode | undefined;
    if (rootNode != null) {
        try {
            const latestRoot = FernNavigation.migrate.FernNavigationV1ToLatest.create().root(rootNode);
            pageIdToSlug = navigationUtils.buildPageIdToSlugMap(latestRoot);
        } catch (navError) {
            app.logger.warn(
                `[finishDocsRegister] Failed to build pageId→slug mapping from nav tree for ${domain}${basepath}`,
                navError
            );
        }
    }

    const existingPages = await app.dao.slugs().getMarkdowns(domain, basepath);
    const existingByPageId = new Map(existingPages.map((e) => [e.pageId, e]));

    const toUpsert: UpsertMarkdownParams[] = [];
    const newPageIds = new Set<string>();

    for (const [pageId, pageContent] of Object.entries(dbDocsDefinition.pages)) {
        if (pageContent == null) {
            continue;
        }
        const hash = createHash("sha256").update(normalizeMarkdownForHashing(pageContent.markdown)).digest("hex");
        const slug = pageIdToSlug.get(pageId) ?? "";
        newPageIds.add(pageId);

        const existing = existingByPageId.get(pageId);
        if (existing == null || existing.hash !== hash || existing.slug !== slug) {
            toUpsert.push({ orgId, domain, basepath, slug, pageId, hash });
        }
    }

    if (toUpsert.length > 0) {
        await app.dao.slugs().upsertMarkdowns(toUpsert);
        app.logger.info(`[finishDocsRegister] Updated ${toUpsert.length} markdown entries for ${domain}${basepath}`);
    }

    const removedPageIds = existingPages.filter((e) => !newPageIds.has(e.pageId)).map((e) => e.pageId);
    if (removedPageIds.length > 0) {
        await app.dao.slugs().deleteMarkdowns(domain, basepath, removedPageIds);
        app.logger.info(
            `[finishDocsRegister] Removed ${removedPageIds.length} stale markdown entries for ${domain}${basepath}`
        );
    }
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

            const cliVersion = (context as { headers: Record<string, string | undefined> }).headers["x-cli-version"];
            const ciSourceHeader = (context as { headers: Record<string, string | undefined> }).headers["x-ci-source"];
            let ciSource: Prisma.JsonObject | undefined;
            if (ciSourceHeader != null) {
                try {
                    ciSource = JSON.parse(ciSourceHeader) as Prisma.JsonObject;
                } catch {
                    app.logger.warn(`[startDocsRegister] Failed to parse X-CI-Source header`);
                }
            }
            if (cliVersionSupportsConflictCheck(cliVersion)) {
                app.logger.debug(
                    `[startDocsRegister] Checking for concurrent publishing (cliVersion=${cliVersion})...`
                );
                const activeDeployment = await app.dao
                    .docsSite()
                    .getLatestPublishingDeployment(fernUrl.hostname, fernUrl.path ?? undefined);
                if (activeDeployment != null) {
                    const ageMs = Date.now() - new Date(activeDeployment.createdAt).getTime();
                    if (ageMs < PUBLISHING_STALENESS_TIMEOUT_MS) {
                        app.logger.info(
                            `[startDocsRegister] Concurrent publish blocked for domain=${fernUrl.getFullUrl()}, activeDeployment=${activeDeployment.id}, age=${Math.round(ageMs / 1000)}s`
                        );
                        throw new ORPCError("CONFLICT", {
                            message:
                                "Another docs publish is currently in progress for this domain. Please try again once the other publish is complete."
                        });
                    }
                    app.logger.info(
                        `[startDocsRegister] Ignoring stale PUBLISHING deployment ${activeDeployment.id} (age=${Math.round(ageMs / 1000)}s, timeout=${PUBLISHING_STALENESS_TIMEOUT_MS / 1000}s)`
                    );
                }
                app.logger.debug(`[startDocsRegister] No concurrent publishing detected`);
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

            app.logger.debug(`[startDocsRegister] Resolving deployer email...`);
            const deployerEmail = await app.services.auth
                .getUserEmailFromAuthHeader({ authHeader: authorization })
                .catch((e) => {
                    app.logger.warn(`[startDocsRegister] Failed to resolve deployer email`, e);
                    return undefined;
                });

            app.logger.debug(`[startDocsRegister] Registering docs site and creating deployment...`);
            await app.dao.docsSite().registerDocsSite({
                domain: fernUrl.hostname,
                orgId: input.orgId,
                basepath: fernUrl.path
            });
            const deploymentId = await app.dao.docsSite().createDeployment({
                domain: fernUrl.hostname,
                orgId: input.orgId,
                basepath: fernUrl.path,
                userId: deployerEmail,
                metadata:
                    cliVersion != null || ciSource != null
                        ? {
                              ...(cliVersion != null ? { cliVersion } : {}),
                              ...(ciSource != null ? { source: ciSource } : {})
                          }
                        : undefined
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
            const domainIdentifier = input.previewId != null ? sanitizePreviewId(input.previewId) : docsRegistrationId;

            let truncatedDomain: string;
            try {
                truncatedDomain = truncateDomainName({
                    orgId: input.orgId,
                    docsRegistrationId: domainIdentifier,
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
            const previewCliVersion = (context as { headers: Record<string, string | undefined> }).headers[
                "x-cli-version"
            ];
            const previewDeployerEmail = await app.services.auth
                .getUserEmailFromAuthHeader({ authHeader: authorization })
                .catch((e) => {
                    app.logger.warn(`[startDocsPreviewRegister] Failed to resolve deployer email`, e);
                    return undefined;
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
                previewUrl: `https://${fernUrl.getFullUrl()}`,
                userId: previewDeployerEmail,
                metadata: previewCliVersion != null ? { cliVersion: previewCliVersion } : undefined
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

                // Update slug table with content hashes for change tracking
                try {
                    await updateMarkdownEntries(app, docsRegistrationInfo, dbDocsDefinition);
                } catch (e) {
                    app.logger.error(
                        `[finishDocsRegister] Failed to update slug table for ${docsRegistrationInfo.fernUrl.getFullUrl()}`,
                        e
                    );
                    // Non-fatal: don't block docs registration on slug table failures
                }

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
                        app.logger.error(
                            `[DocsWrite] Error while trying to write DB docs definition for ${url.getFullUrl()}`,
                            e
                        );
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
                    app.logger.error(
                        `[DocsWrite] Error while trying to revalidate docs for ${docsRegistrationInfo.fernUrl}`,
                        e
                    );
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

                // Fire-and-forget: build properties (async auth resolution) then capture
                void (async () => {
                    try {
                        const builder = await new DocsSitePublishedBuilder()
                            .withOrgId(docsRegistrationInfo.orgId)
                            .withSiteUrl(docsRegistrationInfo.fernUrl.getFullUrl())
                            .withIsPreview(docsRegistrationInfo.isPreview)
                            .fromAuthHeader(authHeader, app.services.auth);
                        app.services.posthog.captureDocsSitePublished(builder.build());
                    } catch (e) {
                        app.logger.error("[finishDocsRegister] Failed to capture PostHog event", e);
                    }
                })();

                return undefined;
            } catch (e) {
                app.logger.error(
                    `[DocsWrite] Error while trying to register docs for ${docsRegistrationInfo.fernUrl}`,
                    e
                );
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
                        `[DocsWrite] Failed to update deployment status to ERROR for ${docsRegistrationInfo.fernUrl.getFullUrl()}`,
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

            await app.services.auth.checkUserIsOrgAdmin({
                authHeader: authorization,
                orgId: docsMetadata.orgId
            });

            await app.services.deleteDocs.deleteDocsSite({
                url,
                orgId: docsMetadata.orgId,
                isPreview: docsMetadata.isPreview
            });

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
