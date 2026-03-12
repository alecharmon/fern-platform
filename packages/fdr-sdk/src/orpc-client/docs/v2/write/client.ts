import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { docsV2WriteContract } from "./contract.js";

export type DocsV2WriteClient = JsonifiedClient<ContractRouterClient<typeof docsV2WriteContract>>;

export interface CreateDocsV2WriteClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createDocsV2WriteClient(options: CreateDocsV2WriteClientOptions): DocsV2WriteClient {
    const link = new OpenAPILink(docsV2WriteContract, {
        url: `${options.baseUrl}/v2/registry/docs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
