export type HttpSnippetLanguage =
    | "curl"
    | "csharp"
    | "go"
    | "java"
    | "javascript"
    | "php"
    | "python"
    | "ruby"
    | "swift"
    | "rust"
    | "typescript";
export const HttpSnippetLanguage = {
    Curl: "curl",
    Csharp: "csharp",
    Go: "go",
    Java: "java",
    Javascript: "javascript",
    Php: "php",
    Python: "python",
    Ruby: "ruby",
    Swift: "swift",
    Rust: "rust",
    Typescript: "typescript"
} as const;

export type HttpSnippetsConfig = boolean | HttpSnippetLanguage[];

export type Language =
    | "en"
    | "es"
    | "fr"
    | "de"
    | "it"
    | "pt"
    | "ja"
    | "zh"
    | "ko"
    | "el"
    | "no"
    | "pl"
    | "ru"
    | "sv"
    | "tr";

export interface FernSettingsConfig {
    searchText: string | undefined;
    disableSearch: boolean | undefined;
    disableAnalytics: boolean | undefined;
    darkModeCode: boolean | undefined;
    defaultSearchFilters: boolean | undefined;
    httpSnippets: HttpSnippetsConfig | undefined;
    hide404Page: boolean | undefined;
    disableExplorerProxy: boolean | undefined;
    language: Language | undefined;
}
