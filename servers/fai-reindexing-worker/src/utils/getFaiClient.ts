import { FernAIClient } from "@fern-api/fai-sdk";

export function getFaiClient({ token, baseUrl }: { token: string; baseUrl?: string }): FernAIClient {
    return new FernAIClient({
        baseUrl: baseUrl ?? "https://fai.buildwithfern.com",
        token: token
    });
}
