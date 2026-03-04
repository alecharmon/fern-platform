import type { FernIr } from "@fern-api/dynamic-ir-sdk";

import type { Environment } from "./Environment";

export type Request = Partial<
    Omit<FernIr.dynamic.EndpointSnippetRequest, "endpoint" | "environment"> & {
        environment: Environment;
    }
>;
