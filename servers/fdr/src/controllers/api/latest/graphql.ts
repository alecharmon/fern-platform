import * as z from "zod";

import { AvailabilitySchema, GraphQlOperationIdSchema } from "./commons";
import { CodeSnippetSchema, LanguageSchema } from "./endpoint";
import { TypeShapeSchema } from "./type";

export const GraphQlOperationTypeSchema = z.enum(["QUERY", "MUTATION", "SUBSCRIPTION"]);
export type GraphQlOperationType = z.infer<typeof GraphQlOperationTypeSchema>;

export const GraphQlArgumentSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    name: z.string(),
    type: TypeShapeSchema,
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

export const GraphQlOperationSchema = z.object({
    description: z.string().nullish(),
    availability: AvailabilitySchema.nullish(),
    namespace: z.array(z.string()).nullish(),
    id: GraphQlOperationIdSchema,
    operationType: GraphQlOperationTypeSchema,
    name: z.string(),
    displayName: z.string().nullish(),
    arguments: z.array(GraphQlArgumentSchema).nullish(),
    returnType: TypeShapeSchema,
    examples: z.array(GraphQlExampleSchema).nullish(),
    snippets: z.record(LanguageSchema, z.array(CodeSnippetSchema)).nullish()
});
export type GraphQlOperation = z.infer<typeof GraphQlOperationSchema>;
