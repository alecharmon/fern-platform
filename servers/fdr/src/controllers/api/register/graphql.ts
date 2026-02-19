import * as z from "zod";

import { AvailabilitySchema, GraphQlOperationIdSchema } from "./commons";
import { TypeReferenceSchema } from "./type";

export const GraphQlOperationTypeSchema = z.enum(["QUERY", "MUTATION", "SUBSCRIPTION"]);
export type GraphQlOperationType = z.infer<typeof GraphQlOperationTypeSchema>;

export const GraphQlArgumentSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    type: TypeReferenceSchema,
    defaultValue: z.unknown().nullish()
});
export type GraphQlArgument = z.infer<typeof GraphQlArgumentSchema>;

export const GraphQlExampleSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    query: z.string(),
    variables: z.record(z.string(), z.unknown()).nullish(),
    response: z.unknown().nullish()
});
export type GraphQlExample = z.infer<typeof GraphQlExampleSchema>;

export const CodeSnippetSchema = z.object({
    description: z.string().nullish(),
    name: z.string().nullish(),
    language: z.string(),
    install: z.string().nullish(),
    code: z.string(),
    generated: z.boolean()
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;

export const LanguageSchema = z.string();
export type Language = z.infer<typeof LanguageSchema>;

export const GraphQlOperationSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    id: GraphQlOperationIdSchema,
    operationType: GraphQlOperationTypeSchema,
    name: z.string(),
    displayName: z.string().nullish(),
    arguments: z.array(GraphQlArgumentSchema).nullish(),
    returnType: TypeReferenceSchema,
    examples: z.array(GraphQlExampleSchema).nullish(),
    snippets: z.record(LanguageSchema, z.array(CodeSnippetSchema)).nullish()
});
export type GraphQlOperation = z.infer<typeof GraphQlOperationSchema>;
