/**
 * Minimal Library IR for Phase 1a stub implementation.
 * Just enough structure to generate placeholder pages and navigation.
 * Will be expanded in Phase 1b when real parser is implemented.
 */

export type LibraryLanguage = "PYTHON" | "CPP";

export interface LibraryDefinition {
    name: string;
    language: LibraryLanguage;
    modules: ModuleDefinition[];
    metadata: LibraryMetadata;
}

export interface LibraryMetadata {
    sourceUrl: string;
    parsedAt: Date;
    parserVersion: string;
}

export interface ModuleDefinition {
    name: string;
    docstring?: string;
    members: MemberDefinition[];
}

export type MemberKind = "class" | "function" | "constant" | "module";

export interface MemberDefinition {
    name: string;
    kind: MemberKind;
    docstring?: string;
    members?: MemberDefinition[]; // Nested members (methods in class, items in submodule)
}
