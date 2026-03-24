import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { slugsContract } from "./contract.js";

export type SlugsClient = JsonifiedClient<ContractRouterClient<typeof slugsContract>>;

export interface CreateSlugsClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createSlugsClient(options: CreateSlugsClientOptions): SlugsClient {
    const link = new OpenAPILink(slugsContract, {
        url: `${options.baseUrl.replace(/\/+$/, "")}/slugs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
