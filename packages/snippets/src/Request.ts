import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import { Environment } from "./Environment";

export type Request = Partial<
  Omit<dynamic.EndpointSnippetRequest, "endpoint" | "environment"> & {
    environment: Environment;
  }
>;
