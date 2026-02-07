/* eslint-disable unused-imports/no-unused-vars */
import type { APIV1Db, DocsV1Db } from "@fern-api/fdr-sdk";

import { FdrApplication, type FdrConfig } from "../app";
import type { FdrServices } from "../app/FdrApplication";
import type { AlgoliaSearchRecord, AlgoliaService, ConfigSegmentTuple } from "../services/algolia";
import type { AuthService } from "../services/auth";
import type { OrgIdsResponse } from "../services/auth/AuthService";
import type { RevalidatedPathsResponse, RevalidatorService } from "../services/revalidator/RevalidatorService";
import type {
    FailedToDeleteIndexSegment,
    FailedToRegisterDocsNotification,
    FailedToRevalidatePathsNotification,
    GeneratingDocsNotification,
    SlackService
} from "../services/slack/SlackService";
import type { ParsedBaseUrl } from "../util/ParsedBaseUrl";

export class MockAlgoliaService implements AlgoliaService {
    generateSearchApiKey(_filters: string): string {
        return "";
    }

    async deleteIndexSegmentRecords(_indexSegmentIds: string[]): Promise<void> {
        return;
    }

    async generateSearchRecords(_: {
        docsDefinition: DocsV1Db.DocsDefinitionDb;
        apiDefinitionsById: Record<string, APIV1Db.DbApiDefinition>;
        configSegmentTuples: ConfigSegmentTuple[];
    }): Promise<AlgoliaSearchRecord[]> {
        return [];
    }

    async uploadSearchRecords(_records: AlgoliaSearchRecord[]): Promise<void> {
        return;
    }
}

import { UserDoesNotHaveCliPermissionError } from "../api/generated/api";

export interface MockAuthServiceConfig {
    orgIds: string[];
    /** Set of org IDs that should be denied CLI permission */
    denyCliPermissionForOrgs?: Set<string>;
}

export class MockAuthService implements AuthService {
    orgIds: string[];
    denyCliPermissionForOrgs: Set<string>;

    constructor({ orgIds, denyCliPermissionForOrgs }: MockAuthServiceConfig) {
        this.orgIds = orgIds;
        this.denyCliPermissionForOrgs = denyCliPermissionForOrgs ?? new Set();
    }

    async checkUserBelongsToOrg(): Promise<void> {
        return;
    }

    async getOrgIdsFromAuthHeader(_authHeader: { authHeader: string | undefined }): Promise<OrgIdsResponse> {
        return {
            type: "success",
            orgIds: new Set<string>(this.orgIds)
        };
    }

    checkOrgHasSnippetsApiAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean | undefined;
    }): Promise<boolean> {
        return Promise.resolve(false);
    }

    checkOrgHasSnippetTemplateAccess({
        authHeader,
        orgId,
        failHard
    }: {
        authHeader: string | undefined;
        orgId: string;
        failHard?: boolean | undefined;
    }): Promise<boolean> {
        return Promise.resolve(false);
    }

    async getWorkOSOrganization(_orgId: { orgId: string }): Promise<string | undefined> {
        return undefined;
    }

    async checkUserHasCliPermission(params: {
        authHeader: string | undefined;
        orgId: string;
        docsUrl?: string;
    }): Promise<void> {
        if (this.denyCliPermissionForOrgs.has(params.orgId)) {
            throw new UserDoesNotHaveCliPermissionError(
                "You do not have permission to publish documentation. Please contact your organization administrator to request CLI access."
            );
        }
        return;
    }
}

class MockSlackService implements SlackService {
    async notify(_message: string, _err: unknown): Promise<void> {
        return;
    }

    async notifyFailedToRegisterDocs(_request: FailedToRegisterDocsNotification): Promise<void> {
        return;
    }

    async notifyFailedToRevalidatePaths(_request: FailedToRevalidatePathsNotification): Promise<void> {
        return;
    }

    async notifyFailedToDeleteIndexSegment(_request: FailedToDeleteIndexSegment): Promise<void> {
        return;
    }

    async notifyGeneratedDocs(_request: GeneratingDocsNotification): Promise<void> {
        return;
    }
}

class MockRevalidatorService implements RevalidatorService {
    async revalidate(_params: { baseUrl: ParsedBaseUrl }): Promise<RevalidatedPathsResponse> {
        return {
            successful: [],
            failed: [],
            revalidationFailed: false
        };
    }
}

export const baseMockFdrConfig: FdrConfig = {
    awsAccessKey: "",
    awsSecretKey: "",
    cdnPublicDocsUrl: "https://files.buildwithfern.com",
    publicDocsS3: {
        bucketName: "fdr",
        bucketRegion: "us-east-1",
        urlOverride: "http://s3-mock:9090"
    },
    privateDocsS3: {
        bucketName: "fdr",
        bucketRegion: "us-east-1",
        urlOverride: "http://s3-mock:9090"
    },
    dbDocsDefinitionS3: {
        bucketName: "fdr",
        bucketRegion: "us-east-1",
        urlOverride: "http://s3-mock:9090"
    },
    privateApiDefinitionSourceS3: {
        bucketName: "fdr",
        bucketRegion: "us-east-1",
        urlOverride: "http://s3-mock:9090"
    },
    libraryDocsS3: {
        bucketName: "fdr",
        bucketRegion: "us-east-1",
        urlOverride: "http://s3-mock:9090"
    },
    pdfExportS3: {
        bucketName: "fdr",
        bucketRegion: "us-east-1",
        urlOverride: "http://s3-mock:9090"
    },
    pdfExportSqs: {
        queueUrl: "http://localhost:4566/000000000000/pdf-export-queue.fifo",
        region: "us-east-1"
    },
    pdfExportCallbackBaseUrl: "http://localhost:9999",
    venusUrl: "",
    domainSuffix: "docs.buildwithfern.com",
    slackToken: "",
    logLevel: "debug",
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    docsCacheEndpoint: process.env.DOCS_CACHE_ENDPOINT || "",
    enableCustomerNotifications: false,
    applicationEnvironment: "mock",
    redisEnabled: false,
    redisClusteringEnabled: false,
    cliPermissionCheckOrgIds: new Set<string>()
};

export function getMockFdrConfig(overrides?: Partial<FdrConfig>): FdrConfig {
    if (overrides) {
        return {
            ...baseMockFdrConfig,
            ...overrides
        };
    }
    return baseMockFdrConfig;
}

export function createMockFdrApplication({
    orgIds,
    services,
    configOverrides,
    denyCliPermissionForOrgs
}: {
    orgIds?: string[];
    services?: Partial<FdrServices>;
    configOverrides?: Partial<FdrConfig>;
    denyCliPermissionForOrgs?: Set<string>;
}) {
    return new FdrApplication(getMockFdrConfig(configOverrides), {
        auth: new MockAuthService({
            orgIds: orgIds ?? [],
            denyCliPermissionForOrgs
        }),
        algolia: new MockAlgoliaService(),
        slack: new MockSlackService(),
        revalidator: new MockRevalidatorService(),
        ...services
    });
}
