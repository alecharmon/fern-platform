import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { docsV2ReadContract } from "./contract.js";

export type DocsV2ReadClient = JsonifiedClient<ContractRouterClient<typeof docsV2ReadContract>>;

export interface CreateDocsV2ReadClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createDocsV2ReadClient(options: CreateDocsV2ReadClientOptions): DocsV2ReadClient {
    const link = new OpenAPILink(docsV2ReadContract, {
        url: `${options.baseUrl}/v2/registry/docs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
