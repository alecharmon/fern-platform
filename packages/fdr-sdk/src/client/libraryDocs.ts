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

// ---------------------------------------------------------------------------
// C++ IR types (derived from fern/apis/cpp-library-docs-ir/openapi.json)
// ---------------------------------------------------------------------------

export namespace cpp {
    export interface CppTypeRef {
        text: string;
        refid: string;
        kindref: string;
    }

    export type CppTypeInfoPartsItem = string | CppTypeRef;

    export interface CppTypeInfo {
        parts: CppTypeInfoPartsItem[];
        display: string | undefined;
        resolvedPath: string | undefined;
        basePath: string | undefined;
    }

    export type CppClassKind = "class" | "struct";
    export type CppVirtuality = "non-virtual" | "virtual" | "pure-virtual";
    export type CppRefQualifier = "lvalue" | "rvalue";
    export type CppAccessSpecifier = "public" | "private" | "protected";
    export type CppParameterDirection = "in" | "out" | "inout";

    // -- Doc segments (inline content) --

    export interface CppDocTextSegment {
        type: "text";
        text: string;
    }
    export interface CppDocCodeSegment {
        type: "code";
        code: string;
    }
    export interface CppDocCodeRefSegment {
        type: "codeRef";
        code: string;
        refid: string;
        kindref: string;
    }
    export interface CppDocRefSegment {
        type: "ref";
        text: string;
        refid: string;
        kindref: string;
    }
    export interface CppDocBoldSegment {
        type: "bold";
        text: string;
    }
    export interface CppDocEmphasisSegment {
        type: "emphasis";
        text: string;
    }
    export interface CppDocLinkSegment {
        type: "link";
        text: string;
        url: string;
    }
    export interface CppDocSubscriptSegment {
        type: "subscript";
        text: string;
    }
    export interface CppDocSuperscriptSegment {
        type: "superscript";
        text: string;
    }

    export type CppDocSegment =
        | CppDocTextSegment
        | CppDocCodeSegment
        | CppDocCodeRefSegment
        | CppDocRefSegment
        | CppDocBoldSegment
        | CppDocEmphasisSegment
        | CppDocLinkSegment
        | CppDocSubscriptSegment
        | CppDocSuperscriptSegment;

    // -- Doc blocks (block-level content) --

    export interface CppParagraphBlock {
        type: "paragraph";
        segments: CppDocSegment[];
    }
    export interface CppCodeBlock {
        type: "codeBlock";
        code: string;
        language: string | undefined;
    }
    export interface CppVerbatimBlock {
        type: "verbatim";
        content: string;
        format: string | undefined;
    }
    export interface CppListBlock {
        type: "list";
        ordered: boolean;
        items: CppDocBlock[][];
    }
    export interface CppImageBlock {
        type: "image";
        path: string;
        caption: string | undefined;
        isInline: boolean;
    }
    export interface CppTitledSectionBlock {
        type: "titledSection";
        title: string | undefined;
        blocks: CppDocBlock[];
    }

    export type CppDocBlock =
        | CppParagraphBlock
        | CppCodeBlock
        | CppVerbatimBlock
        | CppListBlock
        | CppImageBlock
        | CppTitledSectionBlock;

    // -- Docstring --

    export interface CppParamDoc {
        name: string;
        description: CppDocSegment[];
        direction: CppParameterDirection | undefined;
    }

    export interface CppRaisesDoc {
        exception: string;
        description: CppDocSegment[];
    }

    export interface CppDocstringIr {
        summary: CppDocSegment[];
        description: CppDocBlock[];
        params: CppParamDoc[];
        templateParamsDoc: CppParamDoc[];
        returns: CppDocSegment[] | undefined;
        raises: CppRaisesDoc[];
        examples: CppCodeBlock[];
        notes: CppDocSegment[][];
        warnings: CppDocSegment[][];
        remarks: CppDocSegment[][];
        preconditions: CppDocSegment[][];
        postconditions: CppDocSegment[][];
        seeAlso: CppDocSegment[][];
        sinceVersion: string | undefined;
        deprecated: CppDocSegment[] | undefined;
    }

    // -- IR node types --

    export interface CppTemplateParamIr {
        type: string;
        name: string | undefined;
        defaultValue: CppTypeInfo | undefined;
        isVariadic: boolean;
    }

    export interface CppParameterIr {
        name: string;
        typeInfo: CppTypeInfo | undefined;
        defaultValue: CppTypeInfo | undefined;
        arraySuffix: string | undefined;
        direction: CppParameterDirection | undefined;
    }

    export interface CppEnumValueIr {
        name: string;
        id: string | undefined;
        initializer: string | undefined;
        docstring: CppDocstringIr | undefined;
    }

    export interface CppEnumIr {
        name: string;
        path: string;
        isScoped: boolean;
        underlyingType: string | undefined;
        values: CppEnumValueIr[];
        docstring: CppDocstringIr | undefined;
    }

    export interface CppTypedefIr {
        name: string;
        path: string;
        typeInfo: CppTypeInfo | undefined;
        templateParams: CppTemplateParamIr[];
        docstring: CppDocstringIr | undefined;
    }

    export interface CppVariableIr {
        name: string;
        path: string;
        typeInfo: CppTypeInfo | undefined;
        initializer: string | undefined;
        templateParams: CppTemplateParamIr[];
        isStatic: boolean;
        isConstexpr: boolean;
        isMutable: boolean;
        docstring: CppDocstringIr | undefined;
    }

    export interface CppBaseClassRef {
        name: string;
        typeInfo: CppTypeInfo | undefined;
        access: CppAccessSpecifier;
        isVirtual: boolean;
    }

    export interface CppFunctionIr {
        name: string;
        path: string;
        signature: string;
        templateParams: CppTemplateParamIr[];
        parameters: CppParameterIr[];
        returnType: CppTypeInfo | undefined;
        docstring: CppDocstringIr | undefined;
        isStatic: boolean;
        isConst: boolean;
        isConstexpr: boolean;
        isVolatile: boolean;
        isInline: boolean;
        isExplicit: boolean;
        isNoexcept: boolean;
        noexceptExpression: string | undefined;
        isNoDiscard: boolean;
        virtuality: CppVirtuality;
        refQualifier: CppRefQualifier | undefined;
        requiresClause: string | undefined;
        isDeleted: boolean;
    }

    export interface CppClassIr {
        name: string;
        path: string;
        kind: CppClassKind;
        templateParams: CppTemplateParamIr[];
        baseClasses: CppBaseClassRef[];
        derivedClasses: CppBaseClassRef[];
        docstring: CppDocstringIr | undefined;
        isAbstract: boolean;
        isFinal: boolean;
        includeHeader: string | undefined;
        methods: CppFunctionIr[];
        staticMethods: CppFunctionIr[];
        friendFunctions: CppFunctionIr[];
        typedefs: CppTypedefIr[];
        memberVariables: CppVariableIr[];
        enums: CppEnumIr[];
        innerClasses: CppClassIr[];
        relatedMemberRefs: string[];
        sectionLabels: Record<string, string>;
    }

    export interface CppConceptIr {
        name: string;
        path: string;
        templateParams: CppTemplateParamIr[];
        constraintExpression: string | undefined;
        docstring: CppDocstringIr | undefined;
    }

    export interface CppNamespaceIr {
        name: string;
        path: string;
        docstring: CppDocstringIr | undefined;
        classes: CppClassIr[];
        functions: CppFunctionIr[];
        enums: CppEnumIr[];
        typedefs: CppTypedefIr[];
        variables: CppVariableIr[];
        concepts: CppConceptIr[];
        namespaces: CppNamespaceIr[];
    }

    export interface CppGroupIr {
        id: string;
        name: string;
        title: string;
        docstring: CppDocstringIr | undefined;
        memberRefs: string[];
        innerClassRefs: string[];
        innerNamespaceRefs: string[];
        subgroups: CppGroupIr[];
    }

    export interface CppLibraryDocsIr {
        metadata: IrMetadata;
        rootNamespace: CppNamespaceIr;
        groups: CppGroupIr[];
    }
}
