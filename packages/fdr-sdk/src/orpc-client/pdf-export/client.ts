import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { pdfExportContract } from "./contract.js";

export type PdfExportClient = JsonifiedClient<ContractRouterClient<typeof pdfExportContract>>;

export interface CreatePdfExportClientOptions {
    baseUrl: string;
    token: string;
    headers?: Record<string, string>;
}

export function createPdfExportClient(options: CreatePdfExportClientOptions): PdfExportClient {
    const link = new OpenAPILink(pdfExportContract, {
        url: `${options.baseUrl}/pdf-export`,
        headers: () => ({
            Authorization: `Bearer ${options.token}`,
            ...options.headers
        })
    });
    return createORPCClient(link);
}
