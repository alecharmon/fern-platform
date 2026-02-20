import * as z from "zod";

export type {
    CodeSnippet,
    GraphQlArgument,
    GraphQlExample,
    GraphQlOperation,
    GraphQlOperationType
} from "../shared";
export {
    CodeSnippetSchema,
    GraphQlArgumentSchema,
    GraphQlExampleSchema,
    GraphQlOperationSchema,
    GraphQlOperationTypeSchema
} from "../shared";

export const LanguageSchema = z.string();
export type Language = z.infer<typeof LanguageSchema>;
