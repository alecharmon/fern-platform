import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { dashboardContract } from "./contract.js";

export type DashboardClient = JsonifiedClient<ContractRouterClient<typeof dashboardContract>>;

export interface CreateDashboardClientOptions {
    baseUrl: string;
    token: string;
}

export function createDashboardClient(options: CreateDashboardClientOptions): DashboardClient {
    const link = new OpenAPILink(dashboardContract, {
        url: `${options.baseUrl}/dashboard`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`
        })
    });
    return createORPCClient(link);
}
