import * as z from "zod";

export const TypeInfoSchema = z.object({
    display: z.string().optional(),
    resolvedPath: z.string().optional(),
    basePath: z.string().optional()
});
export type TypeInfo = z.infer<typeof TypeInfoSchema>;

export const IRMetadataSchema = z.object({
    packageName: z.string(),
    language: z.string(),
    sourceUrl: z.string().optional(),
    branch: z.string().optional(),
    version: z.string().optional()
});
export type IRMetadata = z.infer<typeof IRMetadataSchema>;

export const DocstringParamIRSchema = z.object({
    name: z.string(),
    type: z.string().optional(),
    description: z.string().optional(),
    default: z.string().optional()
});
export type DocstringParamIR = z.infer<typeof DocstringParamIRSchema>;

export const DocstringReturnsIRSchema = z.object({
    type: z.string().optional(),
    description: z.string().optional()
});
export type DocstringReturnsIR = z.infer<typeof DocstringReturnsIRSchema>;

export const DocstringRaisesIRSchema = z.object({
    type: z.string(),
    description: z.string().optional()
});
export type DocstringRaisesIR = z.infer<typeof DocstringRaisesIRSchema>;

export const DocstringExampleIRSchema = z.object({
    code: z.string(),
    description: z.string().optional()
});
export type DocstringExampleIR = z.infer<typeof DocstringExampleIRSchema>;

export const DocstringIRSchema = z.object({
    summary: z.string().optional(),
    description: z.string().optional(),
    params: z.array(DocstringParamIRSchema),
    returns: DocstringReturnsIRSchema.optional(),
    raises: z.array(DocstringRaisesIRSchema),
    examples: z.array(DocstringExampleIRSchema),
    notes: z.array(z.string()),
    warnings: z.array(z.string())
});
export type DocstringIR = z.infer<typeof DocstringIRSchema>;

export const AttributeIRSchema = z.object({
    name: z.string(),
    path: z.string(),
    typeInfo: TypeInfoSchema.optional(),
    value: z.string().optional(),
    docstring: DocstringIRSchema.optional()
});
export type AttributeIR = z.infer<typeof AttributeIRSchema>;
