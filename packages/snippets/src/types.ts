import type { FernIr } from "@fern-api/dynamic-ir-sdk";

import type { Language } from "./Language";

export type DynamicIR = FernIr.dynamic.DynamicIntermediateRepresentation;
export interface SnippetInput {
    language: Language;
    ir: DynamicIR;
}
