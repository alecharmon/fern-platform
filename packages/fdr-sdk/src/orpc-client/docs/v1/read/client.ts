import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { docsV1ReadContract } from "./contract.js";

export type DocsV1ReadClient = JsonifiedClient<ContractRouterClient<typeof docsV1ReadContract>>;

export interface CreateDocsV1ReadClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createDocsV1ReadClient(options: CreateDocsV1ReadClientOptions): DocsV1ReadClient {
    const link = new OpenAPILink(docsV1ReadContract, {
        url: `${options.baseUrl}/registry/docs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
