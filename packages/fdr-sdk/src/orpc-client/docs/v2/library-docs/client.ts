import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { libraryDocsContract } from "./contract.js";

export type LibraryDocsClient = JsonifiedClient<ContractRouterClient<typeof libraryDocsContract>>;

export interface CreateLibraryDocsClientOptions {
    baseUrl: string;
    token: string;
}

export function createLibraryDocsClient(options: CreateLibraryDocsClientOptions): LibraryDocsClient {
    const link = new OpenAPILink(libraryDocsContract, {
        url: `${options.baseUrl}/v2/registry/docs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
