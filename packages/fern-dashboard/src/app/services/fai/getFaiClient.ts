import { FernAIClient } from "@fern-api/fai-sdk";

export function getFaiClient({ token }: { token: string }): FernAIClient {
    if (process.env.FAI_SERVER_URL == null) {
        throw new Error("FAI_SERVER_URL is not defined in the current environment");
    }
    return new FernAIClient({
        baseUrl: process.env.FAI_SERVER_URL,
        token: token
    });
}
