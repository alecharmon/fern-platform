import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { docsCacheContract } from "./contract.js";

export type DocsCacheClient = JsonifiedClient<ContractRouterClient<typeof docsCacheContract>>;

export interface CreateDocsCacheClientOptions {
    baseUrl: string;
    token: string;
}

export function createDocsCacheClient(options: CreateDocsCacheClientOptions): DocsCacheClient {
    const link = new OpenAPILink(docsCacheContract, {
        url: `${options.baseUrl}/docs-cache`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
