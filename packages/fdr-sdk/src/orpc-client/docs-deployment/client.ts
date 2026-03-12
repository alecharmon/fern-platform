import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { docsDeploymentContract } from "./contract.js";

export type DocsDeploymentClient = JsonifiedClient<ContractRouterClient<typeof docsDeploymentContract>>;

export interface CreateDocsDeploymentClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createDocsDeploymentClient(options: CreateDocsDeploymentClientOptions): DocsDeploymentClient {
    const link = new OpenAPILink(docsDeploymentContract, {
        url: `${options.baseUrl}/docs-deployment`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
