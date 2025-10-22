/* eslint-disable unused-imports/no-unused-vars */
import { AuthType } from "@prisma/client";
import urlJoin from "url-join";
import { v4 as uuidv4 } from "uuid";

import {
  DocsV1Write,
  FdrAPI,
  convertDocsDefinitionToDb,
} from "@fern-api/fdr-sdk";
import { isNonNullish } from "@fern-api/ui-core-utils";

import { DocsV2WriteService } from "../../../api";
import {
  DomainBelongsToAnotherOrgError,
  InvalidUrlError,
  UnauthorizedError,
} from "../../../api/generated/api/resources/commons/errors";
import { DocsRegistrationIdNotFound } from "../../../api/generated/api/resources/docs/resources/v1/resources/write/errors";
import { DomainNotRegisteredError } from "../../../api/generated/api/resources/docs/resources/v2/resources/read";
import { InvalidDomainError } from "../../../api/generated/api/resources/docs/resources/v2/resources/write/errors";
import { type FdrApplication } from "../../../app";
import { type S3DocsFileInfo } from "../../../services/s3";
import { ParsedBaseUrl } from "../../../util/ParsedBaseUrl";

export interface DocsRegistrationInfo {
  fernUrl: ParsedBaseUrl;
  customUrls: ParsedBaseUrl[];
  orgId: FdrAPI.OrgId;
  s3FileInfos: Record<DocsV1Write.FilePath, S3DocsFileInfo>;
  isPreview: boolean;
  authType: AuthType;
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
  domainSuffix,
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
    throw new Error(
      `Organization name "${orgId}" is too long to fit within ${subdomainLimit} character limit`
    );
  }

  const truncatedRegistrationId = docsRegistrationId.slice(0, availableSpace);
  const cleanRegistrationId = truncatedRegistrationId.replace(/-+$/, "");
  return `${prefix}${cleanRegistrationId}${suffix}`;
}

function validateAndParseFernDomainUrl({
  app,
  url,
}: {
  app: FdrApplication;
  url: string;
}): ParsedBaseUrl {
  const baseUrl = ParsedBaseUrl.parse(url);
  if (baseUrl.path != null && pathnameIsMalformed(baseUrl.path)) {
    throw new InvalidUrlError(
      `Domain URL is malformed: https://${baseUrl.hostname + baseUrl.path}`
    );
  }
  if (!baseUrl.hostname.endsWith(app.config.domainSuffix)) {
    throw new InvalidDomainError();
  }
  return baseUrl;
}

function parseCustomDomainUrls({
  customUrls,
}: {
  customUrls: string[];
}): ParsedBaseUrl[] {
  const parsedUrls: ParsedBaseUrl[] = [];
  for (const customUrl of customUrls) {
    const baseUrl = ParsedBaseUrl.parse(customUrl);
    parsedUrls.push(baseUrl);
  }
  return parsedUrls;
}

export function getDocsWriteV2Service(app: FdrApplication): DocsV2WriteService {
  return new DocsV2WriteService({
    startDocsRegister: async (req, res) => {
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: req.body.orgId,
      });

      const fernUrl = validateAndParseFernDomainUrl({
        app,
        url: req.body.domain,
      });
      const customUrls = parseCustomDomainUrls({
        customUrls: req.body.customDomains,
      });

      // ensure that the domains are not already registered by another org
      const { allDomainsOwned: hasOwnership, unownedDomains } = await app.dao
        .docsV2()
        .checkDomainsDontBelongToAnotherOrg(
          [fernUrl, ...customUrls].map((url) => url.getFullUrl()),
          req.body.orgId
        );
      if (!hasOwnership) {
        throw new DomainBelongsToAnotherOrgError(
          `The following domains belong to another organization: ${unownedDomains.join(", ")}`
        );
      }

      const docsRegistrationId = DocsV1Write.DocsRegistrationId(uuidv4());
      const s3FileInfos =
        await app.services.s3.getPresignedDocsAssetsUploadUrls({
          domain: req.body.domain,
          filepaths: req.body.filepaths,
          images: req.body.images ?? [],
          isPrivate: req.body.authConfig?.type === "private",
        });

      await app.services.slack.notifyGeneratedDocs({
        orgId: req.body.orgId,
        urls: [
          fernUrl.toURL().toString(),
          ...customUrls.map((url) => url.toURL().toString()),
        ],
      });
      await app.dao
        .docsRegistration()
        .storeDocsRegistrationById(docsRegistrationId, {
          fernUrl,
          customUrls,
          orgId: req.body.orgId,
          s3FileInfos,
          isPreview: false,
          authType:
            req.body.authConfig?.type === "private"
              ? AuthType.WORKOS_SSO
              : AuthType.PUBLIC,
        });
      return res.send({
        docsRegistrationId,
        uploadUrls: Object.fromEntries(
          Object.entries(s3FileInfos).map(([filepath, fileInfo]) => {
            return [filepath, fileInfo.presignedUrl];
          })
        ),
      });
    },
    startDocsPreviewRegister: async (req, res) => {
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: req.body.orgId,
      });
      const docsRegistrationId = DocsV1Write.DocsRegistrationId(uuidv4());

      let truncatedDomain: string;
      try {
        truncatedDomain = truncateDomainName({
          orgId: req.body.orgId,
          docsRegistrationId,
          domainSuffix: app.config.domainSuffix,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("Organization name")
        ) {
          throw new InvalidUrlError(
            "Organization name is too long to generate a valid secure preview link. Shorten organization name and try again."
          );
        }
        throw error;
      }

      const fernUrl = ParsedBaseUrl.parse(
        urlJoin(truncatedDomain, req.body.basePath ?? "")
      );
      const s3FileInfos =
        await app.services.s3.getPresignedDocsAssetsUploadUrls({
          domain: fernUrl.hostname,
          filepaths: req.body.filepaths,
          images: req.body.images ?? [],
          isPrivate: req.body.authConfig?.type === "private",
        });
      await app.dao
        .docsRegistration()
        .storeDocsRegistrationById(docsRegistrationId, {
          fernUrl,
          customUrls: [],
          orgId: req.body.orgId,
          s3FileInfos,
          isPreview: true,
          authType:
            req.body.authConfig?.type === "private"
              ? AuthType.WORKOS_SSO
              : AuthType.PUBLIC,
        });
      return res.send({
        docsRegistrationId,
        uploadUrls: Object.fromEntries(
          Object.entries(s3FileInfos).map(([filepath, fileInfo]) => {
            return [filepath, fileInfo.presignedUrl];
          })
        ),
        previewUrl: `https://${fernUrl.getFullUrl()}`,
      });
    },
    finishDocsRegister: async (req, res) => {
      const docsRegistrationInfo = await app.dao
        .docsRegistration()
        .getDocsRegistrationById(req.params.docsRegistrationId);
      if (docsRegistrationInfo == null) {
        throw new DocsRegistrationIdNotFound();
      }

      if (req.headers.authorization == null) {
        throw new UnauthorizedError("Authorization header was not specified");
      }
      const authHeader = req.headers.authorization;

      try {
        app.logger.debug(
          `[${docsRegistrationInfo.fernUrl.getFullUrl()}] Called finishDocsRegister`
        );
        await app.services.auth.checkUserBelongsToOrg({
          authHeader: req.headers.authorization,
          orgId: docsRegistrationInfo.orgId,
        });

        app.logger.debug(
          `[${docsRegistrationInfo.fernUrl.getFullUrl()}] Transforming Docs Definition to DB`
        );
        const dbDocsDefinition = convertDocsDefinitionToDb({
          writeShape: req.body.docsDefinition,
          files: docsRegistrationInfo.s3FileInfos,
        });

        const apiDefinitions = (
          await Promise.all(
            dbDocsDefinition.referencedApis.map(
              async (id) => await app.services.db.getApiDefinition(id)
            )
          )
        ).filter(isNonNullish);

        const warmEndpointCachePromises = apiDefinitions.flatMap(
          (apiDefinition) => {
            return Object.entries(apiDefinition.subpackages).flatMap(
              ([_, subpackage]) => {
                if (app.config.localModeOverride) {
                  return;
                }
                return subpackage.endpoints.map(async (endpoint) => {
                  try {
                    const response = await fetch(
                      `https://${docsRegistrationInfo.fernUrl.getFullUrl()}/api/fern-docs/api-definition/${apiDefinition.id}/endpoint/${endpoint.originalEndpointId}`
                    );
                    return response;
                  } catch (e: Error | unknown) {
                    app.logger.warn(
                      `Failed to warm endpoint cache for ${docsRegistrationInfo.fernUrl.getFullUrl()} [api:${apiDefinition.id}, endpoint:${endpoint.originalEndpointId}]`
                    );
                    return null;
                  }
                });
              }
            );
          }
        );

        await app.docsDefinitionCache.storeDocsForUrl({
          docsRegistrationInfo,
          dbDocsDefinition,
          excludeApis: req.body.excludeApis ?? false
        });

        /**
         * IMPORTANT NOTE:
         * vercel cache is not shared between custom domains, so we need to revalidate on EACH custom domain individually
         */
        const liveCustomUrls = [];
        for (const customUrl of docsRegistrationInfo.customUrls) {
          const isLive = await checkDNSConfigured(customUrl);
          if (isLive || app.config.localModeOverride) {
            liveCustomUrls.push(customUrl);
          } else {
            app.logger.info(
              `Skipping revalidation for ${customUrl.getFullUrl()} - domain is not live`
            );
          }
        }

        const urls = [docsRegistrationInfo.fernUrl, ...liveCustomUrls];

        for (const url of urls) {
          try {
            const response = await app.docsDefinitionCache.getDocsForUrl({
              url: url.toURL(),
              excludeApis: req.body.excludeApis ?? false
            });

            await app.services.s3.writeLoadDocsForUrlResponse({
              domain: url.hostname,
              readDocsDefinition: response,
            });
          } catch (e) {
            app.logger.error(
              `Error while trying to write DB docs definition for ${url.getFullUrl()}`,
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
                authHeader,
              });
              if (results.failed.length === 0 && !results.revalidationFailed) {
                app.logger.info(
                  `Successfully revalidated ${results.successful.length} paths.`
                );
              } else {
                await app.services.slack.notifyFailedToRevalidatePaths({
                  domain: baseUrl.getFullUrl(),
                  paths: results,
                });
              }
            })
          );
        } catch (e) {
          app.logger.error(
            `Error while trying to revalidate docs for ${docsRegistrationInfo.fernUrl}`,
            e
          );
          await app.services.slack.notifyFailedToRegisterDocs({
            domain: docsRegistrationInfo.fernUrl.getFullUrl(),
            err: e,
          });
          throw e;
        }

        // warm endpoint cache - this is non-blocking and failures are logged but don't stop the process
        try {
          const warmCacheResults = await Promise.allSettled(
            warmEndpointCachePromises
          );
          const failedWarmCacheCount = warmCacheResults.filter(
            (result) =>
              result.status === "rejected" ||
              (result.status === "fulfilled" && result.value === null)
          ).length;
          if (failedWarmCacheCount > 0) {
            app.logger.warn(
              `Failed to warm a total of ${failedWarmCacheCount} endpoints for ${docsRegistrationInfo.fernUrl.getFullUrl()}`
            );
          }
        } catch (e) {
          app.logger.error(
            `Unexpected error while warming endpoint cache for ${docsRegistrationInfo.fernUrl.getFullUrl()}`,
            e
          );
        }

        return await res.send();
      } catch (e) {
        app.logger.error(
          `Error while trying to register docs for ${docsRegistrationInfo.fernUrl}`,
          e
        );
        await app.services.slack.notifyFailedToRegisterDocs({
          domain: docsRegistrationInfo.fernUrl.getFullUrl(),
          err: e,
        });
        throw e;
      }
    },
    transferOwnershipOfDomain: async (req, res) => {
      // only fern users can transfer domain ownership
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: "fern",
      });

      const parsedUrl = ParsedBaseUrl.parse(req.body.domain);

      await app.dao.docsV2().transferDomainOwner({
        domain: parsedUrl.getFullUrl(),
        toOrgId: req.body.toOrgId,
      });

      return res.send();
    },
    setIsArchived: async (req, res) => {
      const url = ParsedBaseUrl.parse(req.body.url);
      const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url.toURL());
      if (orgId == null) {
        throw new DomainNotRegisteredError();
      }

      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId,
      });

      await app.dao.docsV2().setIsDocsDefinitionArchived({
        url,
        isArchived: req.body.isArchived,
      });

      return res.send();
    },
    setDocsUrlMetadata: async (req, res) => {
      const url = ParsedBaseUrl.parse(req.body.url);
      const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url.toURL());
      if (orgId == null) {
        throw new DomainNotRegisteredError();
      }

      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId,
      });

      await app.dao.docsV2().setDocsMetadata({
        url,
        metadata: {
          githubUrl: req.body.githubUrl,
        },
      });

      return res.send();
    },
    addAlgoliaPreviewWhitelistEntry: async (req, res) => {
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: "fern",
      });

      await app.dao.docsV2().addAlgoliaPreviewWhitelistEntry(req.body.domain);

      return res.send();
    },
    removeAlgoliaPreviewWhitelistEntry: async (req, res) => {
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: "fern",
      });

      await app.dao.docsV2().removeAlgoliaPreviewWhitelistEntry(req.body.domain);

      return res.send();
    },
    listAlgoliaPreviewWhitelist: async (req, res) => {
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: "fern",
      });

      const domains = await app.dao.docsV2().listAlgoliaPreviewWhitelist();

      return res.send({ domains });
    },
    deleteDocsSite: async (req, res) => {
      const url = ParsedBaseUrl.parse(req.body.url);
      const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(url.toURL());
      if (orgId == null) {
        throw new DomainNotRegisteredError();
      }

      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId,
      });

      app.logger.info(`Stub: Delete docs site called for ${url.getFullUrl()}`);

      return res.send();
    },
  });
}

async function checkDNSConfigured(baseUrl: ParsedBaseUrl) {
  try {
    const response = await fetch(
      `https://${baseUrl.hostname}${baseUrl.path || ""}`,
      {
        method: "HEAD",
        redirect: "manual",
      }
    );

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("getaddrinfo ENOTFOUND") ||
        (error.name === "TypeError" && error.message.includes("fetch"))
      ) {
        return false;
      }
    } else if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOTFOUND"
    ) {
      return false;
    }

    return true;
  }
}
