import { createDocsV1ReadClient, type DocsV1ReadClient } from "./v1/read/client.js";
import { createDocsV1WriteClient, type DocsV1WriteClient } from "./v1/write/client.js";
import { createLibraryDocsClient, type LibraryDocsClient } from "./v2/library-docs/client.js";
import { createOrganizationClient, type OrganizationClient } from "./v2/organization/client.js";
import { createDocsV2ReadClient, type DocsV2ReadClient } from "./v2/read/client.js";
import { createDocsV2WriteClient, type DocsV2WriteClient } from "./v2/write/client.js";

export interface DocsClient {
    v1: {
        read: DocsV1ReadClient;
        write: DocsV1WriteClient;
    };
    v2: {
        read: DocsV2ReadClient;
        write: DocsV2WriteClient;
        libraryDocs: LibraryDocsClient;
        organization: OrganizationClient;
    };
}

export interface CreateDocsClientOptions {
    baseUrl: string;
    token: string;
}

export function createDocsClient(options: CreateDocsClientOptions): DocsClient {
    return {
        v1: {
            read: createDocsV1ReadClient(options),
            write: createDocsV1WriteClient(options)
        },
        v2: {
            read: createDocsV2ReadClient(options),
            write: createDocsV2WriteClient(options),
            libraryDocs: createLibraryDocsClient(options),
            organization: createOrganizationClient(options)
        }
    };
}
