import * as z from "zod";

export const TypeInfoSchema = z.object({
    display: z.string().nullish(),
    resolvedPath: z.string().nullish(),
    basePath: z.string().nullish()
});
export type TypeInfo = z.infer<typeof TypeInfoSchema>;

export const IRMetadataSchema = z.object({
    packageName: z.string(),
    language: z.string(),
    sourceUrl: z.string().nullish(),
    branch: z.string().nullish(),
    version: z.string().nullish()
});
export type IRMetadata = z.infer<typeof IRMetadataSchema>;

export const DocstringParamIRSchema = z.object({
    name: z.string(),
    type: z.string().nullish(),
    description: z.string().nullish(),
    default: z.string().nullish()
});
export type DocstringParamIR = z.infer<typeof DocstringParamIRSchema>;

export const DocstringReturnsIRSchema = z.object({
    type: z.string().nullish(),
    description: z.string().nullish()
});
export type DocstringReturnsIR = z.infer<typeof DocstringReturnsIRSchema>;

export const DocstringRaisesIRSchema = z.object({
    type: z.string(),
    description: z.string().nullish()
});
export type DocstringRaisesIR = z.infer<typeof DocstringRaisesIRSchema>;

export const DocstringExampleIRSchema = z.object({
    code: z.string(),
    description: z.string().nullish()
});
export type DocstringExampleIR = z.infer<typeof DocstringExampleIRSchema>;

export const DocstringIRSchema = z.object({
    summary: z.string().nullish(),
    description: z.string().nullish(),
    params: z.array(DocstringParamIRSchema),
    returns: DocstringReturnsIRSchema.nullish(),
    raises: z.array(DocstringRaisesIRSchema),
    examples: z.array(DocstringExampleIRSchema),
    notes: z.array(z.string()),
    warnings: z.array(z.string())
});
export type DocstringIR = z.infer<typeof DocstringIRSchema>;

export const AttributeIRSchema = z.object({
    name: z.string(),
    path: z.string(),
    typeInfo: TypeInfoSchema.nullish(),
    value: z.string().nullish(),
    docstring: DocstringIRSchema.nullish()
});
export type AttributeIR = z.infer<typeof AttributeIRSchema>;
