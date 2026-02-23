import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { generatorVersionsContract } from "../contract.js";

export type GeneratorVersionsClient = JsonifiedClient<ContractRouterClient<typeof generatorVersionsContract>>;

export interface CreateGeneratorVersionsClientOptions {
    baseUrl: string;
    token: string;
}

export function createGeneratorVersionsClient(options: CreateGeneratorVersionsClientOptions): GeneratorVersionsClient {
    const link = new OpenAPILink(generatorVersionsContract, {
        url: `${options.baseUrl}/generators/versions`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
