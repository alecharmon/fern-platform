import type { ModelMessage } from "ai";
import { template } from "es-toolkit/compat";
import { STATIC_SYSTEM_PROMPT } from "./static-system-prompt";

export const createDefaultSystemPrompt = (data: {
    domain: string;
    documents: string;
    promptTemplate?: string;
    availableTools: string[];
}): ModelMessage[] => {
    if (!data.promptTemplate) {
        data.promptTemplate = "";
    }

    return [
        {
            role: "system",
            content: STATIC_SYSTEM_PROMPT,
            providerOptions: {
                bedrock: {
                    cachePoint: { type: "default" }
                }
            }
        },
        {
            role: "system",
            content: template(
                `You are operating on the domain {{domain}}
                
{{promptTemplate}}

---

You have access to the following documents:
{{documents}}

---
`,
                { interpolate: /{{([^}]+)}}/g }
            )(data)
        }
    ];
};
