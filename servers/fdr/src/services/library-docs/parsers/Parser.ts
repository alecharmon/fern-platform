import type { LibraryDefinition } from "../ir/types";

export interface ParserConfig {
    githubUrl: string;
    packagePath?: string;
    include?: string[];
    exclude?: string[];
}

export interface Parser {
    parse(repoPath: string, config: ParserConfig): Promise<LibraryDefinition>;
}
