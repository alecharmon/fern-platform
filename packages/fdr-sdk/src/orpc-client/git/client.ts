import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { gitContract } from "./contract.js";

export type GitClient = JsonifiedClient<ContractRouterClient<typeof gitContract>>;

export interface CreateGitClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createGitClient(options: CreateGitClientOptions): GitClient {
    const link = new OpenAPILink(gitContract, {
        url: `${options.baseUrl}/generators/github`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
