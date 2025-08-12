import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import { Language } from "./Language";

export interface GeneratorConfig {
  workspaceName?: string;
  organization?: string;
  customConfig?: unknown;
}

export interface SnippetInput {
  language: Language;
  ir: dynamic.DynamicIntermediateRepresentation;
  config: GeneratorConfig;
}
