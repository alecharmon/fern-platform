import * as z from "zod";

import { AvailabilitySchema, GraphQlOperationIdSchema } from "../register/commons";
import { CodeSnippetSchema, LanguageSchema } from "../register/graphql";
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
