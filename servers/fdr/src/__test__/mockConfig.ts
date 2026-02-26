import type { FdrConfig } from "../app/FdrConfig";

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
