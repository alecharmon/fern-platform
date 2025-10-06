const VENUS_URL_ENV_VAR = "VENUS_URL";
const AWS_ACCESS_KEY_ENV_VAR = "AWS_ACCESS_KEY_ID";
const AWS_SECRET_KEY_ENV_VAR = "AWS_SECRET_ACCESS_KEY";

const PUBLIC_S3_BUCKET_NAME_ENV_VAR = "PUBLIC_S3_BUCKET_NAME";
const PUBLIC_S3_BUCKET_REGION_ENV_VAR = "PUBLIC_S3_BUCKET_REGION";
const PUBLIC_S3_URL_OVERRIDE_ENV_VAR = "PUBLIC_S3_URL_OVERRIDE";

const PRIVATE_S3_BUCKET_NAME_ENV_VAR = "PRIVATE_S3_BUCKET_NAME";
const PRIVATE_S3_BUCKET_REGION_ENV_VAR = "PRIVATE_S3_BUCKET_REGION";
const PRIVATE_S3_URL_OVERRIDE_ENV_VAR = "PRIVATE_S3_URL_OVERRIDE";

const DB_DOCS_DEFINITION_BUCKET_NAME_ENV_VAR = "DB_DOCS_DEFINITION_BUCKET_NAME";
const DB_DOCS_DEFINITION_BUCKET_REGION_ENV_VAR = "DB_DOCS_DEFINITION_BUCKET_REGION";
const DB_DOCS_DEFINITION_BUCKET_URL_OVERRIDE_ENV_VAR = "DB_DOCS_DEFINITION_BUCKET_URL_OVERRIDE";

const API_DEFINITION_SOURCE_BUCKET_NAME_ENV_VAR = "API_DEFINITION_SOURCE_BUCKET_NAME";
const API_DEFINITION_SOURCE_BUCKET_REGION_ENV_VAR = "API_DEFINITION_SOURCE_BUCKET_REGION";
const API_DEFINITION_SOURCE_BUCKET_URL_OVERRIDE_ENV_VAR = "API_DEFINITION_SOURCE_BUCKET_URL_OVERRIDE";

const DOMAIN_SUFFIX_ENV_VAR = "DOMAIN_SUFFIX";
const SLACK_TOKEN_ENV_VAR = "SLACK_TOKEN";
const LOG_LEVEL_ENV_VAR = "LOG_LEVEL";
const DOCS_CACHE_ENDPOINT_ENV_VAR = "DOCS_CACHE_ENDPOINT";
const ENABLE_CUSTOMER_NOTIFICATIONS_ENV_VAR = "ENABLE_CUSTOMER_NOTIFICATIONS";
const REDIS_ENABLED_ENV_VAR = "REDIS_ENABLED";
const REDIS_CLUSTERING_ENABLED_ENV_VAR = "REDIS_CLUSTERING_ENABLED";
const APPLICATION_ENVIRONMENT_ENV_VAR = "APPLICATION_ENVIRONMENT";
const PUBLIC_DOCS_CDN_URL = "PUBLIC_DOCS_CDN_URL";

// Self-hosted env variables
const MINIO_USERNAME = "MINIO_USERNAME";
const MINIO_PASSWORD = "MINIO_PASSWORD";
const MINIO_URL = "MINIO_URL";
const MINIO_BUCKET_NAME = "MINIO_BUCKET_NAME";
const S3_FORCE_PATH_STYLE = "S3_FORCE_PATH_STYLE";

export interface S3Config {
    bucketName: string;
    bucketRegion: string;
    urlOverride?: string;
    forcePathStyle?: boolean;
}

export interface FdrConfig {
    localModeOverride: boolean;
    venusUrl: string;
    awsAccessKey: string;
    awsSecretKey: string;
    cdnPublicDocsUrl: string;
    publicDocsS3: S3Config;
    privateDocsS3: S3Config;
    dbDocsDefinitionS3: S3Config;
    privateApiDefinitionSourceS3: S3Config;
    domainSuffix: string;
    slackToken: string;
    logLevel: string;
    docsCacheEndpoint: string;
    enableCustomerNotifications: boolean;
    redisEnabled: boolean;
    redisClusteringEnabled: boolean;
    applicationEnvironment: string;
}

function getSelfHostedS3Config(): S3Config {
    return {
        bucketName: getEnvironmentVariableOrThrow(MINIO_BUCKET_NAME),
        bucketRegion: "global",
        urlOverride: getEnvironmentVariableOrThrow(MINIO_URL),
        forcePathStyle: process.env[S3_FORCE_PATH_STYLE] === "true"
    };
}

function getConfigForLocalMode(): FdrConfig {
    const selfHostedS3Config = getSelfHostedS3Config();

    return {
        localModeOverride: true,
        venusUrl: "",
        awsAccessKey: getEnvironmentVariableOrThrow(MINIO_USERNAME),
        awsSecretKey: getEnvironmentVariableOrThrow(MINIO_PASSWORD),
        publicDocsS3: selfHostedS3Config,
        privateDocsS3: selfHostedS3Config,
        dbDocsDefinitionS3: selfHostedS3Config,
        privateApiDefinitionSourceS3: selfHostedS3Config,
        domainSuffix: "docs.buildwithfern.com",
        slackToken: "local",
        logLevel: "info",
        docsCacheEndpoint: "local",
        enableCustomerNotifications: false,
        redisEnabled: false,
        redisClusteringEnabled: false,
        applicationEnvironment: "local",
        cdnPublicDocsUrl: "_files"
    };
}

export function getConfig(): FdrConfig {
    const localMode = process.env["LOCAL_MODE_OVERRIDE"] ?? "false";
    const shouldOverride = localMode === "true";
    if (shouldOverride) {
        return getConfigForLocalMode();
    }

    return {
        localModeOverride: false,
        venusUrl: getEnvironmentVariableOrThrow(VENUS_URL_ENV_VAR),
        awsAccessKey: getEnvironmentVariableOrThrow(AWS_ACCESS_KEY_ENV_VAR),
        awsSecretKey: getEnvironmentVariableOrThrow(AWS_SECRET_KEY_ENV_VAR),
        publicDocsS3: {
            bucketName: getEnvironmentVariableOrThrow(PUBLIC_S3_BUCKET_NAME_ENV_VAR),
            bucketRegion: getEnvironmentVariableOrThrow(PUBLIC_S3_BUCKET_REGION_ENV_VAR),
            urlOverride: process.env[PUBLIC_S3_URL_OVERRIDE_ENV_VAR]
        },
        privateDocsS3: {
            bucketName: getEnvironmentVariableOrThrow(PRIVATE_S3_BUCKET_NAME_ENV_VAR),
            bucketRegion: getEnvironmentVariableOrThrow(PRIVATE_S3_BUCKET_REGION_ENV_VAR),
            urlOverride: process.env[PRIVATE_S3_URL_OVERRIDE_ENV_VAR]
        },
        dbDocsDefinitionS3: {
            bucketName: getEnvironmentVariableOrThrow(DB_DOCS_DEFINITION_BUCKET_NAME_ENV_VAR),
            bucketRegion: getEnvironmentVariableOrThrow(DB_DOCS_DEFINITION_BUCKET_REGION_ENV_VAR),
            urlOverride: process.env[DB_DOCS_DEFINITION_BUCKET_URL_OVERRIDE_ENV_VAR]
        },
        privateApiDefinitionSourceS3: {
            bucketName: getEnvironmentVariableOrThrow(API_DEFINITION_SOURCE_BUCKET_NAME_ENV_VAR),
            bucketRegion: getEnvironmentVariableOrThrow(API_DEFINITION_SOURCE_BUCKET_REGION_ENV_VAR),
            urlOverride: process.env[API_DEFINITION_SOURCE_BUCKET_URL_OVERRIDE_ENV_VAR]
        },
        domainSuffix: getEnvironmentVariableOrThrow(DOMAIN_SUFFIX_ENV_VAR),
        slackToken: getEnvironmentVariableOrThrow(SLACK_TOKEN_ENV_VAR),
        logLevel: process.env[LOG_LEVEL_ENV_VAR] ?? "info",
        docsCacheEndpoint: getEnvironmentVariableOrThrow(DOCS_CACHE_ENDPOINT_ENV_VAR),
        enableCustomerNotifications: getEnvironmentVariableOrThrow(ENABLE_CUSTOMER_NOTIFICATIONS_ENV_VAR) === "true",
        redisEnabled: process.env[REDIS_ENABLED_ENV_VAR] === "true",
        redisClusteringEnabled: process.env[REDIS_CLUSTERING_ENABLED_ENV_VAR] === "true",
        applicationEnvironment: getEnvironmentVariableOrThrow(APPLICATION_ENVIRONMENT_ENV_VAR),
        cdnPublicDocsUrl: getEnvironmentVariableOrThrow(PUBLIC_DOCS_CDN_URL)
    };
}

function getEnvironmentVariableOrThrow(environmentVariable: string): string {
    const value = process.env[environmentVariable];
    if (value == null) {
        throw new Error(`Environment variable ${environmentVariable} not found`);
    }
    return value;
}
