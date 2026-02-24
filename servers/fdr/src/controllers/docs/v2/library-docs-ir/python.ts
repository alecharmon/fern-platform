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
    typeInfo: TypeInfoSchema.nullish(),
    default: z.string().nullish(),
    description: z.string().nullish(),
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
    typeInfo: TypeInfoSchema.nullish(),
    description: z.string().nullish(),
    required: z.boolean()
});
export type TypedDictFieldIR = z.infer<typeof TypedDictFieldIRSchema>;

export const BaseClassRefSchema = z.object({
    name: z.string(),
    typeInfo: TypeInfoSchema.nullish()
});
export type BaseClassRef = z.infer<typeof BaseClassRefSchema>;

export const PythonFunctionIRSchema = z.object({
    name: z.string(),
    path: z.string(),
    signature: z.string(),
    docstring: DocstringIRSchema.nullish(),
    parameters: z.array(PythonParameterIRSchema),
    returnTypeInfo: TypeInfoSchema.nullish(),
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
    docstring: DocstringIRSchema.nullish(),
    constructorParams: z.array(PythonParameterIRSchema),
    methods: z.array(PythonFunctionIRSchema),
    attributes: z.array(AttributeIRSchema),
    decorators: z.array(z.string()),
    metaclass: z.string().nullish(),
    isAbstract: z.boolean(),
    hasSlots: z.boolean(),
    typedDictFields: z.array(TypedDictFieldIRSchema).nullish(),
    enumMembers: z.array(EnumMemberIRSchema).nullish()
});
export type PythonClassIR = z.infer<typeof PythonClassIRSchema>;

export type PythonModuleIR = {
    name: string;
    path: string;
    docstring?: z.infer<typeof DocstringIRSchema> | null;
    classes: z.infer<typeof PythonClassIRSchema>[];
    functions: z.infer<typeof PythonFunctionIRSchema>[];
    attributes: z.infer<typeof AttributeIRSchema>[];
    submodules: PythonModuleIR[];
};

export const PythonModuleIRSchema: z.ZodType<PythonModuleIR> = z.lazy(() =>
    z.object({
        name: z.string(),
        path: z.string(),
        docstring: DocstringIRSchema.nullish(),
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
