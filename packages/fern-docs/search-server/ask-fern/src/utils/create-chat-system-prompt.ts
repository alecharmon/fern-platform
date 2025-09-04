import { createCohereSystemPrompt } from "../utils/cohere-system-prompt";
import {
  createDefaultSystemPrompt,
  createSystemPromptForProvidedDocuments as createSystemPromptForUserProvidedDocuments,
} from "../utils/system-prompt";

export function createChatSystemPrompt({
  modelProvider,
  domain,
  date,
  documents,
  promptTemplate,
  documentsProvidedByUser = false,
  availableTools,
}: {
  modelProvider: string;
  domain: string;
  date: string;
  documents: string;
  promptTemplate?: string;
  documentsProvidedByUser?: boolean;
  availableTools: string[];
}) {
  return modelProvider === "cohere"
    ? createCohereSystemPrompt({
        domain,
        date,
        documents,
        promptTemplate,
      })
    : documentsProvidedByUser
      ? createSystemPromptForUserProvidedDocuments({
          domain,
          date,
          documents,
          promptTemplate,
          availableTools,
        })
      : createDefaultSystemPrompt({
          domain,
          date,
          documents,
          promptTemplate,
          availableTools,
        });
}
