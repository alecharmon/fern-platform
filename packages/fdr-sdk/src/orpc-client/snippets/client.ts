import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { snippetsContract, snippetsFactoryContract } from "./contract.js";

export type SnippetsFactoryClient = JsonifiedClient<ContractRouterClient<typeof snippetsFactoryContract>>;
export type SnippetsClient = JsonifiedClient<ContractRouterClient<typeof snippetsContract>>;

export interface CreateSnippetsClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createSnippetsFactoryClient(options: CreateSnippetsClientOptions): SnippetsFactoryClient {
    const link = new OpenAPILink(snippetsFactoryContract, {
        url: `${options.baseUrl}/snippets`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}

export function createSnippetsClient(options: CreateSnippetsClientOptions): SnippetsClient {
    const link = new OpenAPILink(snippetsContract, {
        url: `${options.baseUrl}/snippets`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
