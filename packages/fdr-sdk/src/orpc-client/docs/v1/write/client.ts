import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { docsV1WriteContract } from "./contract.js";

export type DocsV1WriteClient = JsonifiedClient<ContractRouterClient<typeof docsV1WriteContract>>;

export interface CreateDocsV1WriteClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createDocsV1WriteClient(options: CreateDocsV1WriteClientOptions): DocsV1WriteClient {
    const link = new OpenAPILink(docsV1WriteContract, {
        url: `${options.baseUrl}/registry/docs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
