import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import { Language } from "./Language";

export type DynamicIR = dynamic.DynamicIntermediateRepresentation;
export interface SnippetInput {
    language: Language;
    ir: DynamicIR;
}
