import type { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import type { Environment } from "./Environment";

export type Request = Partial<
    Omit<dynamic.EndpointSnippetRequest, "endpoint" | "environment"> & {
        environment: Environment;
    }
>;
