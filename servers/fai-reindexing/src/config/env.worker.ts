/**
 * Environment configuration for delegated workers
 * All values passed via containerOverrides from the orchestrator
 */

function getEnvVar(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const workerEnv = {
    get awsRegion() {
        return process.env.AWS_REGION || "us-east-1";
    },

    get turbopufferApiKey() {
        return getEnvVar("TURBOPUFFER_API_KEY");
    },
    get openaiApiKey() {
        return getEnvVar("OPENAI_API_KEY");
    },
    get fernToken() {
        return getEnvVar("FERN_TOKEN");
    },

    get faiOrigin() {
        return process.env.FAI_ORIGIN || "https://fai.buildwithfern.com";
    },
    get fdrOrigin() {
        return process.env.FDR_ORIGIN || "https://registry.buildwithfern.com";
    },
    get fdrLambdaOrigin() {
        return process.env.FDR_LAMBDA_ORIGIN || "https://registry-v2.buildwithfern.com";
    },

    get fernDocsIndexName() {
        return process.env.FERN_DOCS_INDEX_NAME || "fern-docs";
    },

    get posthogApiKey() {
        return process.env.POSTHOG_API_KEY;
    },

    get environment() {
        return process.env.ENVIRONMENT || "dev";
    }
};
