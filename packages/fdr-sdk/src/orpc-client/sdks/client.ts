import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { sdksContract } from "./contract.js";

export type SdksClient = JsonifiedClient<ContractRouterClient<typeof sdksContract>>;

export interface CreateSdksClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createSdksClient(options: CreateSdksClientOptions): SdksClient {
    const link = new OpenAPILink(sdksContract, {
        url: `${options.baseUrl}/sdks`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
