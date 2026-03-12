import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { generatorCliContract } from "../contract.js";

export type GeneratorCliClient = JsonifiedClient<ContractRouterClient<typeof generatorCliContract>>;

export interface CreateGeneratorCliClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createGeneratorCliClient(options: CreateGeneratorCliClientOptions): GeneratorCliClient {
    const link = new OpenAPILink(generatorCliContract, {
        url: `${options.baseUrl}/generators/cli`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
