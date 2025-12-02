import { withDefaultProtocol } from "@fern-api/ui-core-utils";

export function meilisearchApiKey(): string {
    return process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY ?? "fern123!";
}

export function meilisearchOrigin(): string {
    return process.env.NEXT_PUBLIC_MEILISEARCH_ORIGIN ?? "http://localhost:7700";
}

export function algoliaAppId(): string {
    return getEnvVariable("ALGOLIA_APP_ID");
}

export function algoliaWriteApiKey(): string {
    return getEnvVariable("ALGOLIA_WRITE_API_KEY");
}

export function algoliaSearchApikey(): string {
    return getEnvVariable("ALGOLIA_SEARCH_API_KEY");
}

export function fernToken_admin(): string {
    return getEnvVariable("FERN_TOKEN");
}

export function fdrEnvironment(): string {
    return getEnvVariable("NEXT_PUBLIC_FDR_ORIGIN");
}

export function qstashToken(): string {
    return getEnvVariable("QSTASH_TOKEN");
}

export function qstashBaseUrl(): string {
    return getEnvVariable("QSTASH_URL");
}

export function qstashCurrentSigningKey(): string {
    return getEnvVariable("QSTASH_CURRENT_SIGNING_KEY");
}

export function qstashNextSigningKey(): string {
    return getEnvVariable("QSTASH_NEXT_SIGNING_KEY");
}

export function turbopufferApiKey(): string {
    return getEnvVariable("TURBOPUFFER_API_KEY");
}

export function anthropicApiKey(): string {
    return getEnvVariable("ANTHROPIC_API_KEY");
}

export function openaiApiKey(): string {
    return getEnvVariable("OPENAI_API_KEY");
}

export function getFaiOrigin(): string {
    return withDefaultProtocol(process.env.NEXT_PUBLIC_FAI_ORIGIN ?? "https://fai.buildwithfern.com");
}

export function getFdrOrigin(): string {
    return withDefaultProtocol(process.env.NEXT_PUBLIC_FDR_ORIGIN ?? "https://registry.buildwithfern.com");
}

export function getFdrLambdaOrigin(): string {
    return withDefaultProtocol(process.env.NEXT_PUBLIC_FDR_LAMBDA_ORIGIN ?? "https://registry-v2.buildwithfern.com");
}

export function cohereApiKey(): string {
    return getEnvVariable("COHERE_API_KEY");
}

export function getFaiChatUrl(): string {
    return getEnvVariable("FAI_CHAT_URL");
}

function assertNonNullable<T>(value: T, key: string): asserts value is NonNullable<T> {
    if (value == null) {
        throw new Error(`${key} is not defined`);
    }
}

function getEnvVariable(key: string) {
    const env = process.env[key];
    assertNonNullable(env, key);
    return env;
}
