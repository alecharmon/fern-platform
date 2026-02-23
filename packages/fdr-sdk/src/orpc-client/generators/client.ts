import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { generatorsContract } from "./contract.js";

export type GeneratorsRootClient = JsonifiedClient<ContractRouterClient<typeof generatorsContract>>;

export interface CreateGeneratorsRootClientOptions {
    baseUrl: string;
    token: string;
}

export function createGeneratorsRootClient(options: CreateGeneratorsRootClientOptions): GeneratorsRootClient {
    const link = new OpenAPILink(generatorsContract, {
        url: `${options.baseUrl}/generators`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
