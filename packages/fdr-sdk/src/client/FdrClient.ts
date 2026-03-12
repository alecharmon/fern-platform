import { type CreateFdrORPCClientOptions, createFdrORPCClient, type FdrORPCClient } from "../orpc-client/client.js";

export type { CreateFdrORPCClientOptions, FdrORPCClient };
export { createFdrORPCClient };

export interface FdrClientOptions {
    environment?: string;
    token?: string;
    headers?: Record<string, string>;
}

/**
 * Backward-compatible FdrClient class that wraps the oRPC composite client.
 * Supports `new FdrClient({ environment, token })` syntax used by downstream packages.
 */
export class FdrClient {
    private readonly client: FdrORPCClient;

    constructor(options: FdrClientOptions = {}) {
        this.client = createFdrORPCClient({
            baseUrl: options.environment ?? "https://registry.buildwithfern.com",
            token: options.token ?? "",
            headers: options.headers
        });
    }

    get api() {
        return this.client.api;
    }
    get dashboard() {
        return this.client.dashboard;
    }
    get docs() {
        return this.client.docs;
    }
    get docsCache() {
        return this.client.docsCache;
    }
    get generators() {
        return this.client.generators;
    }
    get git() {
        return this.client.git;
    }
    get pdfExport() {
        return this.client.pdfExport;
    }
    get sdks() {
        return this.client.sdks;
    }
    get snippets() {
        return this.client.snippets;
    }
    get snippetsFactory() {
        return this.client.snippetsFactory;
    }
    get templates() {
        return this.client.templates;
    }
    get tokens() {
        return this.client.tokens;
    }
}
