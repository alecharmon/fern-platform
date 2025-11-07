import { z } from "zod";

export const SuggestionsSchema = z.object({
    suggestions: z
        .array(z.string())
        .length(5)
        .describe("Exactly 5 question suggestions based on the search results provided.")
});

export type Suggestions = z.infer<typeof SuggestionsSchema>;
