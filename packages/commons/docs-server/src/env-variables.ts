import { withDefaultProtocol } from "@fern-api/ui-core-utils";

export function meilisearchApiKey(): string {
    return getEnvVariable("MEILISEARCH_MASTER_KEY");
}

export function meilisearchOrigin(): string {
    return getEnvVariable("MEILISEARCH_ORIGIN");
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
    const value = process.env.NEXT_PUBLIC_FDR_ORIGIN;
    assertNonNullable(value, "NEXT_PUBLIC_FDR_ORIGIN");
    return value;
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

/**
 * NEXT_PUBLIC_* env vars must use static property access (not dynamic process.env[key])
 * so that Next.js can inline them at build time for client-side code.
 */
export function getFaiOrigin(): string {
    const value = process.env.NEXT_PUBLIC_FAI_ORIGIN;
    assertNonNullable(value, "NEXT_PUBLIC_FAI_ORIGIN");
    return withDefaultProtocol(value);
}

export function getFdrOrigin(): string {
    const value = process.env.NEXT_PUBLIC_FDR_ORIGIN;
    assertNonNullable(value, "NEXT_PUBLIC_FDR_ORIGIN");
    return withDefaultProtocol(value);
}

export function getFdrLambdaOrigin(): string {
    const value = process.env.NEXT_PUBLIC_FDR_LAMBDA_ORIGIN;
    assertNonNullable(value, "NEXT_PUBLIC_FDR_LAMBDA_ORIGIN");
    return withDefaultProtocol(value);
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
