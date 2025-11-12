import type { ModelMessage } from "ai";

import { createCohereSystemPrompt } from "../utils/cohere-system-prompt";
import { createDefaultSystemPrompt } from "../utils/system-prompt";

export function createChatSystemPrompt({
    modelProvider,
    domain,
    documents,
    promptTemplate,
    availableTools
}: {
    modelProvider: string;
    domain: string;
    documents: string;
    promptTemplate?: string;
    availableTools: string[];
}): ModelMessage[] {
    return modelProvider === "cohere"
        ? createCohereSystemPrompt({
              domain,
              documents,
              promptTemplate
          })
        : createDefaultSystemPrompt({
              domain,
              documents,
              promptTemplate,
              availableTools
          });
}
