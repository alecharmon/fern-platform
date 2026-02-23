import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { organizationContract } from "./contract.js";

export type OrganizationClient = JsonifiedClient<ContractRouterClient<typeof organizationContract>>;

export interface CreateOrganizationClientOptions {
    baseUrl: string;
    token: string;
}

export function createOrganizationClient(options: CreateOrganizationClientOptions): OrganizationClient {
    const link = new OpenAPILink(organizationContract, {
        url: `${options.baseUrl}/v2/registry/docs`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
