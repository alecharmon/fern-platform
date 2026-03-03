/**
 * Library Docs IR types.
 *
 * These types describe the intermediate representation produced by the
 * server-side library documentation parser. They are consumed by the
 * library-docs-generator package in the fern CLI to render MDX pages.
 */

// ---------------------------------------------------------------------------
// Shared / IR types
// ---------------------------------------------------------------------------

export interface DocstringExampleIr {
    code: string;
    description: string | undefined;
}

export interface DocstringParamIr {
    name: string;
    type: string | undefined;
    description: string | undefined;
    default: string | undefined;
}

export interface DocstringRaisesIr {
    type: string;
    description: string | undefined;
}

export interface DocstringReturnsIr {
    type: string | undefined;
    description: string | undefined;
}

export interface DocstringIr {
    summary: string | undefined;
    description: string | undefined;
    params: DocstringParamIr[];
    returns: DocstringReturnsIr | undefined;
    raises: DocstringRaisesIr[];
    examples: DocstringExampleIr[];
    notes: string[];
    warnings: string[];
}

export interface IrMetadata {
    packageName: string;
    language: string;
    sourceUrl: string | undefined;
    branch: string | undefined;
    version: string | undefined;
}

export interface TypeInfo {
    display: string | undefined;
    resolvedPath: string | undefined;
    basePath: string | undefined;
}

export interface AttributeIr {
    name: string;
    path: string;
    typeInfo: TypeInfo | undefined;
    value: string | undefined;
    docstring: DocstringIr | undefined;
}

// ---------------------------------------------------------------------------
// Python-specific types
// ---------------------------------------------------------------------------

export interface BaseClassRef {
    name: string;
    typeInfo: TypeInfo | undefined;
}

export interface EnumMemberIr {
    name: string;
    value: string;
}

export const PythonClassKind = {
    Class: "CLASS",
    Dataclass: "DATACLASS",
    Typeddict: "TYPEDDICT",
    Protocol: "PROTOCOL",
    Enum: "ENUM",
    Exception: "EXCEPTION"
} as const;
export type PythonClassKind = (typeof PythonClassKind)[keyof typeof PythonClassKind];

export const PythonParameterKind = {
    Positional: "POSITIONAL",
    Keyword: "KEYWORD",
    VarPositional: "VAR_POSITIONAL",
    VarKeyword: "VAR_KEYWORD",
    KeywordOnly: "KEYWORD_ONLY"
} as const;
export type PythonParameterKind = (typeof PythonParameterKind)[keyof typeof PythonParameterKind];

export interface PythonParameterIr {
    name: string;
    typeInfo: TypeInfo | undefined;
    default: string | undefined;
    description: string | undefined;
    kind: PythonParameterKind;
}

export interface TypedDictFieldIr {
    name: string;
    typeInfo: TypeInfo | undefined;
    description: string | undefined;
    required: boolean;
}

export interface PythonFunctionIr {
    name: string;
    path: string;
    signature: string;
    docstring: DocstringIr | undefined;
    parameters: PythonParameterIr[];
    returnTypeInfo: TypeInfo | undefined;
    isAsync: boolean;
    decorators: string[];
    isClassmethod: boolean;
    isStaticmethod: boolean;
    isProperty: boolean;
}

export interface PythonClassIr {
    name: string;
    path: string;
    kind: PythonClassKind;
    bases: BaseClassRef[];
    docstring: DocstringIr | undefined;
    constructorParams: PythonParameterIr[];
    methods: PythonFunctionIr[];
    attributes: AttributeIr[];
    decorators: string[];
    metaclass: string | undefined;
    isAbstract: boolean;
    hasSlots: boolean;
    typedDictFields: TypedDictFieldIr[] | undefined;
    enumMembers: EnumMemberIr[] | undefined;
}

export interface PythonModuleIr {
    name: string;
    path: string;
    docstring: DocstringIr | undefined;
    classes: PythonClassIr[];
    functions: PythonFunctionIr[];
    attributes: AttributeIr[];
    submodules: PythonModuleIr[];
}

export interface PythonLibraryDocsIr {
    metadata: IrMetadata;
    rootModule: PythonModuleIr;
}
