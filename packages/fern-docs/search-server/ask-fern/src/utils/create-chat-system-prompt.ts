import { createCohereSystemPrompt } from "../utils/cohere-system-prompt";
import { createDefaultSystemPrompt } from "../utils/system-prompt";

export function createChatSystemPrompt({
    modelProvider,
    domain,
    date,
    documents,
    promptTemplate,
    availableTools
}: {
    modelProvider: string;
    domain: string;
    date: string;
    documents: string;
    promptTemplate?: string;
    availableTools: string[];
}) {
    return modelProvider === "cohere"
        ? createCohereSystemPrompt({
              domain,
              date,
              documents,
              promptTemplate
          })
        : createDefaultSystemPrompt({
              domain,
              date,
              documents,
              promptTemplate,
              availableTools
          });
}
