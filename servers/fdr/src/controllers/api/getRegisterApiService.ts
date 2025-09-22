import urlJoin from "url-join";
import { v4 as uuidv4 } from "uuid";

import {
  APIV1Db,
  APIV1Write,
  FdrAPI,
  SDKSnippetHolder,
  convertAPIDefinitionToDb,
} from "@fern-api/fdr-sdk";

import { APIV1WriteService } from "../../api";
import { SdkRequest } from "../../api/generated/api";
import {
  DynamicIr,
  DynamicIrUpload,
} from "../../api/generated/api/resources/api/resources/v1/resources/register";
import type { FdrApplication } from "../../app";
import { LOGGER } from "../../app/FdrApplication";
import { SdkIdForPackage } from "../../db/sdk/SdkDao";
import {
  SnippetTemplatesByEndpoint,
  SnippetTemplatesByEndpointIdentifier,
} from "../../db/snippets/SnippetTemplate";
import { writeBuffer } from "../../util";

const REGISTER_API_DEFINITION_META = {
  service: "APIV1WriteService",
  endpoint: "registerApiDefinition",
};

const SLOW_OPERATION_THRESHOLD_MS = 30000; // 30 seconds

function logSlowOperation(operation: string, durationMs: number) {
  LOGGER.warn(
    `Operation "${operation}" took ${durationMs}ms (threshold: ${SLOW_OPERATION_THRESHOLD_MS}ms)`,
    REGISTER_API_DEFINITION_META
  );
}

export function getRegisterApiService(app: FdrApplication): APIV1WriteService {
  return new APIV1WriteService({
    registerApiDefinition: async (req, res) => {
      const startTime = Date.now();
      let lastOperationTime = startTime;

      const logOperationTime = (operation: string) => {
        const now = Date.now();
        const duration = now - lastOperationTime;
        if (duration > SLOW_OPERATION_THRESHOLD_MS) {
          logSlowOperation(operation, duration);
        }
        lastOperationTime = now;
      };

      app.logger.debug(
        `Checking if user belongs to org ${req.body.orgId}`,
        REGISTER_API_DEFINITION_META
      );
      await app.services.auth.checkUserBelongsToOrg({
        authHeader: req.headers.authorization,
        orgId: req.body.orgId,
      });
      logOperationTime("checkUserBelongsToOrg");

      let apiDefinitionId = FdrAPI.ApiDefinitionId(uuidv4());
      let transformedApiDefinition:
        | APIV1Db.DbApiDefinition
        | FdrAPI.api.latest.ApiDefinition
        | undefined;

      const snippetsConfiguration = req.body.definition
        ?.snippetsConfiguration ?? {
        typescriptSdk: undefined,
        pythonSdk: undefined,
        javaSdk: undefined,
        goSdk: undefined,
        rubySdk: undefined,
        csharpSdk: undefined,
        phpSdk: undefined,
        swiftSdk: undefined,
      };

      const snippetsConfigurationWithSdkIds = await app.dao
        .sdks()
        .getSdkIdsForPackages(snippetsConfiguration);
      logOperationTime("getSdkIdsForPackages");

      const sdkIds: string[] = [];
      if (snippetsConfigurationWithSdkIds.typescriptSdk != null) {
        sdkIds.push(snippetsConfigurationWithSdkIds.typescriptSdk.sdkId);
      }
      if (snippetsConfigurationWithSdkIds.pythonSdk != null) {
        sdkIds.push(snippetsConfigurationWithSdkIds.pythonSdk.sdkId);
      }
      if (snippetsConfigurationWithSdkIds.javaSdk != null) {
        sdkIds.push(snippetsConfigurationWithSdkIds.javaSdk.sdkId);
      }
      if (snippetsConfigurationWithSdkIds.goSdk != null) {
        sdkIds.push(snippetsConfigurationWithSdkIds.goSdk.sdkId);
      }
      if (snippetsConfigurationWithSdkIds.rubySdk != null) {
        sdkIds.push(snippetsConfigurationWithSdkIds.rubySdk.sdkId);
      }
      if (snippetsConfigurationWithSdkIds.csharpSdk != null) {
        sdkIds.push(snippetsConfigurationWithSdkIds.csharpSdk.sdkId);
      }

      let snippetsBySdkId = {};
      let snippetsBySdkIdAndEndpointId = {};
      let snippetTemplatesByEndpoint: SnippetTemplatesByEndpoint = {};
      let snippetTemplatesByEndpointId: SnippetTemplatesByEndpointIdentifier =
        {};

      if (!req.body.dynamicIRs) {
        app.logger.debug("No dynamicIRs detected, creating snippet holder");

        snippetsBySdkId = await app.dao
          .snippets()
          .loadAllSnippetsForSdkIds(sdkIds);
        logOperationTime("loadAllSnippetsForSdkIds");

        snippetsBySdkIdAndEndpointId = await app.dao
          .snippets()
          .loadAllSnippetsForSdkIdsByEndpointId(sdkIds);
        logOperationTime("loadAllSnippetsForSdkIdsByEndpointId");

        snippetTemplatesByEndpoint = await getSnippetTemplatesIfEnabled({
          app,
          authorization: req.headers.authorization,
          orgId: req.body.orgId,
          apiId: req.body.apiId,
          definition: req.body.definition ?? req.body.definitionV2,
          snippetsConfigurationWithSdkIds,
        });
        logOperationTime("getSnippetTemplatesIfEnabled");

        snippetTemplatesByEndpointId =
          await getSnippetTemplatesByEndpointIdIfEnabled({
            app,
            authorization: req.headers.authorization,
            orgId: req.body.orgId,
            apiId: req.body.apiId,
            definition: req.body.definition ?? req.body.definitionV2,
            snippetsConfigurationWithSdkIds,
          });
        logOperationTime("getSnippetTemplatesByEndpointIdIfEnabled");
      } else {
        app.logger.debug("Receieved dynamicIR - using empty snippet holder");
      }

      const snippetHolder = new SDKSnippetHolder({
        snippetsBySdkId,
        snippetsBySdkIdAndEndpointId,
        snippetsConfigWithSdkId: snippetsConfigurationWithSdkIds,
        snippetTemplatesByEndpoint,
        snippetTemplatesByEndpointId,
      });

      if (
        req.body.definition != null &&
        Object.keys(req.body.definition).length > 0
      ) {
        transformedApiDefinition = convertAPIDefinitionToDb(
          req.body.definition,
          apiDefinitionId,
          snippetHolder
        );
      }
      logOperationTime("convertAPIDefinitionToDb");

      let sources: Record<string, APIV1Write.SourceUpload> | undefined;
      if (req.body.sources != null) {
        app.logger.debug(
          `Preparing source upload URLs for {orgId: "${req.body.orgId}", apiId: "${req.body.apiId}"}`,
          REGISTER_API_DEFINITION_META
        );
        sources = await getSourceUploads({
          app,
          orgId: req.body.orgId,
          apiId: req.body.apiId,
          sources: req.body.sources,
        });
        logOperationTime("getSourceUploads");
        app.logger.debug(
          "Successfully prepared source upload URLs",
          REGISTER_API_DEFINITION_META
        );
      }

      let dynamicIRsUploads: Record<string, DynamicIrUpload> | undefined;
      if (req.body.dynamicIRs) {
        app.logger.debug(
          `Preparing dynamic IR upload URLs for {orgId: "${req.body.orgId}", apiId: "${req.body.apiId}"}`,
          REGISTER_API_DEFINITION_META
        );
        dynamicIRsUploads = await getDynamicIrsUploads({
          app,
          orgId: req.body.orgId,
          apiId: apiDefinitionId,
          dynamicIRs: req.body.dynamicIRs,
        });

        logOperationTime("getDynamicIrsUploads");
        app.logger.debug(
          "Successfully prepared dynamic IR upload URLs",
          REGISTER_API_DEFINITION_META
        );
      }

      app.logger.debug(
        `Creating API Definition in database with id=${apiDefinitionId}, name=${req.body.apiId} for org ${req.body.orgId}`,
        REGISTER_API_DEFINITION_META
      );
      await app.services.db.prisma.apiDefinitionsV2.create({
        data: {
          apiDefinitionId,
          apiName: req.body.apiId,
          orgId: req.body.orgId,
          definition: writeBuffer(transformedApiDefinition),
        },
      });
      logOperationTime("createApiDefinition");

      const totalDuration = Date.now() - startTime;
      LOGGER.warn(
        `API Registration for ${req.body.orgId}:${req.body.apiId} took ${totalDuration}ms`,
        REGISTER_API_DEFINITION_META
      );

      app.logger.debug(
        `Returning API Definition ID id=${apiDefinitionId}`,
        REGISTER_API_DEFINITION_META
      );
      return res.send({
        apiDefinitionId,
        sources,
        dynamicIRs: dynamicIRsUploads,
      });
    },
  });
}

function getSnippetSdkRequests({
  snippetsConfigurationWithSdkIds,
}: {
  snippetsConfigurationWithSdkIds: SdkIdForPackage;
}): SdkRequest[] {
  const sdkRequests: SdkRequest[] = [];
  if (snippetsConfigurationWithSdkIds.typescriptSdk != null) {
    sdkRequests.push({
      type: "typescript",
      package: snippetsConfigurationWithSdkIds.typescriptSdk.package,
      version: snippetsConfigurationWithSdkIds.typescriptSdk.version,
    });
  }
  if (snippetsConfigurationWithSdkIds.pythonSdk != null) {
    sdkRequests.push({
      type: "python",
      package: snippetsConfigurationWithSdkIds.pythonSdk.package,
      version: snippetsConfigurationWithSdkIds.pythonSdk.version,
    });
  }
  if (snippetsConfigurationWithSdkIds.javaSdk != null) {
    const coordinate = snippetsConfigurationWithSdkIds.javaSdk.coordinate;
    const [group, artifact] = coordinate.split(":");
    if (group == null || artifact == null) {
      throw new Error(
        `Invalid coordinate for Java SDK: ${coordinate}. Must be in the format group:artifact`
      );
    }
    sdkRequests.push({
      type: "java",
      group,
      artifact,
      version: snippetsConfigurationWithSdkIds.javaSdk.version,
    });
  }
  if (snippetsConfigurationWithSdkIds.goSdk != null) {
    sdkRequests.push({
      type: "go",
      githubRepo: snippetsConfigurationWithSdkIds.goSdk.githubRepo,
      version: snippetsConfigurationWithSdkIds.goSdk.version,
    });
  }
  if (snippetsConfigurationWithSdkIds.rubySdk != null) {
    sdkRequests.push({
      type: "ruby",
      gem: snippetsConfigurationWithSdkIds.rubySdk.gem,
      version: snippetsConfigurationWithSdkIds.rubySdk.version,
    });
  }
  if (snippetsConfigurationWithSdkIds.csharpSdk != null) {
    sdkRequests.push({
      type: "csharp",
      package: snippetsConfigurationWithSdkIds.csharpSdk.package,
      version: snippetsConfigurationWithSdkIds.csharpSdk.version,
    });
  }
  return sdkRequests;
}

async function getSnippetTemplatesByEndpointIdIfEnabled({
  app,
  authorization,
  orgId,
  apiId,
  definition,
  snippetsConfigurationWithSdkIds,
}: {
  app: FdrApplication;
  authorization: string | undefined;
  orgId: FdrAPI.OrgId;
  apiId: FdrAPI.ApiId;
  definition:
    | APIV1Write.ApiDefinition
    | FdrAPI.api.latest.ApiDefinition
    | undefined;
  snippetsConfigurationWithSdkIds: SdkIdForPackage;
}): Promise<SnippetTemplatesByEndpointIdentifier> {
  try {
    if (definition == null) {
      return {};
    }
    const hasSnippetTemplatesAccess =
      await app.services.auth.checkOrgHasSnippetTemplateAccess({
        authHeader: authorization,
        orgId,
        failHard: false,
      });
    let snippetTemplatesByEndpoint: SnippetTemplatesByEndpointIdentifier = {};
    if (hasSnippetTemplatesAccess) {
      const sdkRequests = getSnippetSdkRequests({
        snippetsConfigurationWithSdkIds,
      });
      snippetTemplatesByEndpoint = await app.dao
        .snippetTemplates()
        .loadSnippetTemplatesByEndpointIdentifier({
          orgId,
          apiId,
          sdkRequests,
          definition,
        });
    }
    return snippetTemplatesByEndpoint;
  } catch (e) {
    LOGGER.error("Failed to load snippet templates", e);
    return {};
  }
}

async function getSnippetTemplatesIfEnabled({
  app,
  authorization,
  orgId,
  apiId,
  definition,
  snippetsConfigurationWithSdkIds,
}: {
  app: FdrApplication;
  authorization: string | undefined;
  orgId: FdrAPI.OrgId;
  apiId: FdrAPI.ApiId;
  definition:
    | APIV1Write.ApiDefinition
    | FdrAPI.api.latest.ApiDefinition
    | undefined;
  snippetsConfigurationWithSdkIds: SdkIdForPackage;
}): Promise<SnippetTemplatesByEndpoint> {
  try {
    if (definition == null) {
      return {};
    }
    const hasSnippetTemplatesAccess =
      await app.services.auth.checkOrgHasSnippetTemplateAccess({
        authHeader: authorization,
        orgId,
        failHard: false,
      });
    let snippetTemplatesByEndpoint: SnippetTemplatesByEndpoint = {};
    if (hasSnippetTemplatesAccess) {
      const sdkRequests = getSnippetSdkRequests({
        snippetsConfigurationWithSdkIds,
      });
      snippetTemplatesByEndpoint = await app.dao
        .snippetTemplates()
        .loadSnippetTemplatesByEndpoint({
          orgId,
          apiId,
          sdkRequests,
          definition,
        });
    }
    return snippetTemplatesByEndpoint;
  } catch (e) {
    LOGGER.error("Failed to load snippet templates", e);
    return {};
  }
}

async function getDynamicIrsUploads({
  app,
  orgId,
  apiId,
  dynamicIRs,
}: {
  app: FdrApplication;
  orgId: FdrAPI.OrgId;
  apiId: APIV1Db.ApiDefinitionId;
  dynamicIRs: Record<string, DynamicIr> | undefined;
}): Promise<Record<string, DynamicIrUpload>> {
  const sourceUploadUrls =
    await app.services.s3.getPresignedApiDefinitionDynamicIRsUploadUrls({
      orgId,
      apiId,
      dynamicIRs,
    });

  const sourceUploads = await Promise.all(
    Object.entries(sourceUploadUrls).map(async ([language, fileInfo]) => {
      return [
        language,
        {
          uploadUrl: fileInfo.presignedUrl,
        },
      ];
    })
  );

  return Object.fromEntries(sourceUploads);
}

async function getSourceUploads({
  app,
  orgId,
  apiId,
  sources,
}: {
  app: FdrApplication;
  orgId: FdrAPI.OrgId;
  apiId: FdrAPI.ApiId;
  sources: Record<string, APIV1Write.Source> | undefined;
}): Promise<Record<string, APIV1Write.SourceUpload>> {
  const sourceUploadUrls =
    await app.services.s3.getPresignedApiDefinitionSourceUploadUrls({
      orgId,
      apiId,
      sources,
    });

  const sourceUploads = await Promise.all(
    Object.entries(sourceUploadUrls).map(async ([sourceId, fileInfo]) => {
      const downloadUrl =
        await app.services.s3.getPresignedApiDefinitionSourceDownloadUrl({
          key: fileInfo.key,
        });

      return [
        sourceId,
        {
          uploadUrl: fileInfo.presignedUrl,
          downloadUrl,
        },
      ];
    })
  );

  return Object.fromEntries(sourceUploads);
}
