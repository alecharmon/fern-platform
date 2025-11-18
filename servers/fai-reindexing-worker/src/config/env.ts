/**
 * Environment configuration for the reindexing worker
 */

export const env = {
    sqsQueueUrl: getEnvVar("SQS_QUEUE_URL"),

    turbopufferApiKey: getEnvVar("TURBOPUFFER_API_KEY"),
    openaiApiKey: getEnvVar("OPENAI_API_KEY"),

    fernToken: getEnvVar("FERN_TOKEN"),
    faiOrigin: process.env.FAI_ORIGIN || "https://fai.buildwithfern.com",
    fdrOrigin: process.env.FDR_ORIGIN || "https://registry.buildwithfern.com",
    fdrLambdaOrigin: process.env.FDR_LAMBDA_ORIGIN || "https://registry-v2.buildwithfern.com",

    fernDocsIndexName: process.env.FERN_DOCS_INDEX_NAME || "fern-docs",

    kvUrl: process.env.KV_URL,
    kvRestApiUrl: process.env.KV_REST_API_URL,
    kvRestApiToken: process.env.KV_REST_API_TOKEN,
    kvRestApiReadOnlyToken: process.env.KV_REST_API_READ_ONLY_TOKEN
} as const;

function getEnvVar(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
