import { getFaiOrigin } from "@fern-api/docs-server/env-variables";
import { FernAIClient } from "@fern-api/fai-sdk";

export function getFaiClient({ token, baseUrl }: { token: string; baseUrl?: string }): FernAIClient {
    return new FernAIClient({
        baseUrl: baseUrl ?? getFaiOrigin(),
        token: token
    });
}
