import * as z from "zod";

import { AttributeIRSchema, DocstringIRSchema, IRMetadataSchema, TypeInfoSchema } from "./ir";

export const PythonClassKindSchema = z.enum(["CLASS", "DATACLASS", "TYPEDDICT", "PROTOCOL", "ENUM", "EXCEPTION"]);
export type PythonClassKind = z.infer<typeof PythonClassKindSchema>;

export const PythonParameterKindSchema = z.enum([
    "POSITIONAL",
    "KEYWORD",
    "VAR_POSITIONAL",
    "VAR_KEYWORD",
    "KEYWORD_ONLY"
]);
export type PythonParameterKind = z.infer<typeof PythonParameterKindSchema>;

export const PythonParameterIRSchema = z.object({
    name: z.string(),
    typeInfo: TypeInfoSchema.optional(),
    default: z.string().optional(),
    description: z.string().optional(),
    kind: PythonParameterKindSchema
});
export type PythonParameterIR = z.infer<typeof PythonParameterIRSchema>;

export const EnumMemberIRSchema = z.object({
    name: z.string(),
    value: z.string()
});
export type EnumMemberIR = z.infer<typeof EnumMemberIRSchema>;

export const TypedDictFieldIRSchema = z.object({
    name: z.string(),
    typeInfo: TypeInfoSchema.optional(),
    description: z.string().optional(),
    required: z.boolean()
});
export type TypedDictFieldIR = z.infer<typeof TypedDictFieldIRSchema>;

export const BaseClassRefSchema = z.object({
    name: z.string(),
    typeInfo: TypeInfoSchema.optional()
});
export type BaseClassRef = z.infer<typeof BaseClassRefSchema>;

export const PythonFunctionIRSchema = z.object({
    name: z.string(),
    path: z.string(),
    signature: z.string(),
    docstring: DocstringIRSchema.optional(),
    parameters: z.array(PythonParameterIRSchema),
    returnTypeInfo: TypeInfoSchema.optional(),
    isAsync: z.boolean(),
    decorators: z.array(z.string()),
    isClassmethod: z.boolean(),
    isStaticmethod: z.boolean(),
    isProperty: z.boolean()
});
export type PythonFunctionIR = z.infer<typeof PythonFunctionIRSchema>;

export const PythonClassIRSchema = z.object({
    name: z.string(),
    path: z.string(),
    kind: PythonClassKindSchema,
    bases: z.array(BaseClassRefSchema),
    docstring: DocstringIRSchema.optional(),
    constructorParams: z.array(PythonParameterIRSchema),
    methods: z.array(PythonFunctionIRSchema),
    attributes: z.array(AttributeIRSchema),
    decorators: z.array(z.string()),
    metaclass: z.string().optional(),
    isAbstract: z.boolean(),
    hasSlots: z.boolean(),
    typedDictFields: z.array(TypedDictFieldIRSchema).optional(),
    enumMembers: z.array(EnumMemberIRSchema).optional()
});
export type PythonClassIR = z.infer<typeof PythonClassIRSchema>;

export type PythonModuleIR = {
    name: string;
    path: string;
    docstring?: z.infer<typeof DocstringIRSchema>;
    classes: z.infer<typeof PythonClassIRSchema>[];
    functions: z.infer<typeof PythonFunctionIRSchema>[];
    attributes: z.infer<typeof AttributeIRSchema>[];
    submodules: PythonModuleIR[];
};

export const PythonModuleIRSchema: z.ZodType<PythonModuleIR> = z.lazy(() =>
    z.object({
        name: z.string(),
        path: z.string(),
        docstring: DocstringIRSchema.optional(),
        classes: z.array(PythonClassIRSchema),
        functions: z.array(PythonFunctionIRSchema),
        attributes: z.array(AttributeIRSchema),
        submodules: z.array(PythonModuleIRSchema)
    })
);

export const PythonLibraryDocsIRSchema = z.object({
    metadata: IRMetadataSchema,
    rootModule: PythonModuleIRSchema
});
export type PythonLibraryDocsIR = z.infer<typeof PythonLibraryDocsIRSchema>;
