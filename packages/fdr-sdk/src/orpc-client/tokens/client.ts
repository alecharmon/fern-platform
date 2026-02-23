import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { tokensContract } from "./contract.js";

export type TokensClient = JsonifiedClient<ContractRouterClient<typeof tokensContract>>;

export interface CreateTokensClientOptions {
    baseUrl: string;
    token: string;
}

export function createTokensClient(options: CreateTokensClientOptions): TokensClient {
    const link = new OpenAPILink(tokensContract, {
        url: `${options.baseUrl}/tokens`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
