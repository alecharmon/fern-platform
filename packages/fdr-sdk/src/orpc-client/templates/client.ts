import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { templatesContract } from "./contract.js";

export type TemplatesClient = JsonifiedClient<ContractRouterClient<typeof templatesContract>>;

export interface CreateTemplatesClientOptions {
    baseUrl: string;
    token: string;
}

export function createTemplatesClient(options: CreateTemplatesClientOptions): TemplatesClient {
    const link = new OpenAPILink(templatesContract, {
        url: `${options.baseUrl}/snippet-template`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
