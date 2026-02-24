import * as z from "zod";

// ── Org / API identifiers ──────────────────────────────────────────────

export const OrgIdSchema = z.string();
export type OrgId = z.infer<typeof OrgIdSchema>;
export function OrgId(value: string): OrgId {
    return value;
}

export const ApiIdSchema = z.string();
export type ApiId = z.infer<typeof ApiIdSchema>;
export function ApiId(value: string): ApiId {
    return value;
}

export const ApiDefinitionIdSchema = z.string().uuid();
export type ApiDefinitionId = z.infer<typeof ApiDefinitionIdSchema>;
export function ApiDefinitionId(value: string): ApiDefinitionId {
    return value;
}

// ── HTTP / Endpoint schemas ─────────────────────────────────────────────

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const HttpMethod = {
    Get: "GET",
    Post: "POST",
    Put: "PUT",
    Patch: "PATCH",
    Delete: "DELETE",
    Head: "HEAD"
} as const;

export const UrlSchema: z.ZodType<Url> = z.string() as any;
export type Url = string & { Url: void };
export function Url(value: string): Url {
    return value as unknown as Url;
}

export const EndpointPathLiteralSchema = z.string();
export type EndpointPathLiteral = z.infer<typeof EndpointPathLiteralSchema>;
export function EndpointPathLiteral(value: string): EndpointPathLiteral {
    return value;
}

export const EndpointIdentifierSchema = z.object({
    path: z.string(),
    method: HttpMethodSchema,
    identifierOverride: z.string().optional()
});
export type EndpointIdentifier = z.infer<typeof EndpointIdentifierSchema>;

// ── SDK request schema ──────────────────────────────────────────────────

export type SdkRequest =
    | { type: "typescript"; package: string; version: string | undefined }
    | { type: "python"; package: string; version: string | undefined }
    | { type: "go"; githubRepo: string; version: string | undefined }
    | { type: "ruby"; gem: string; version: string | undefined }
    | { type: "java"; group: string; artifact: string; version: string | undefined }
    | { type: "csharp"; package: string; version: string | undefined };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SdkRequestSchema: z.ZodType<SdkRequest> = z.discriminatedUnion("type", [
    z.object({ type: z.literal("typescript"), package: z.string(), version: z.string().optional() }),
    z.object({ type: z.literal("python"), package: z.string(), version: z.string().optional() }),
    z.object({ type: z.literal("go"), githubRepo: z.string(), version: z.string().optional() }),
    z.object({ type: z.literal("ruby"), gem: z.string(), version: z.string().optional() }),
    z.object({
        type: z.literal("java"),
        group: z.string(),
        artifact: z.string(),
        version: z.string().optional()
    }),
    z.object({ type: z.literal("csharp"), package: z.string(), version: z.string().optional() })
]) as any;

// ── Additional identifiers ─────────────────────────────────────────────

export const DocsConfigIdSchema = z.string();
export type DocsConfigId = z.infer<typeof DocsConfigIdSchema>;
export function DocsConfigId(value: string): DocsConfigId {
    return value;
}

export const GrpcIdSchema = z.string();
export type GrpcId = z.infer<typeof GrpcIdSchema>;
export function GrpcId(value: string): GrpcId {
    return value;
}

export const PageIdSchema = z.string();
export type PageId = z.infer<typeof PageIdSchema>;
export function PageId(value: string): PageId {
    return value;
}

export const RoleIdSchema = z.string();
export type RoleId = z.infer<typeof RoleIdSchema>;
export function RoleId(value: string): RoleId {
    return value;
}

export const TokenIdSchema = z.string();
export type TokenId = z.infer<typeof TokenIdSchema>;

export const VersionIdSchema = z.string();
export type VersionId = z.infer<typeof VersionIdSchema>;
export function VersionId(value: string): VersionId {
    return value;
}

// ── Enums ──────────────────────────────────────────────────────────────

export const LinkTarget = {
    Blank: "_blank",
    Self: "_self",
    Parent: "_parent",
    Top: "_top"
} as const;
export type LinkTarget = (typeof LinkTarget)[keyof typeof LinkTarget];

export const GrpcMethod = {
    Unary: "UNARY",
    ClientStream: "CLIENT_STREAM",
    ServerStream: "SERVER_STREAM",
    BidirectionalStream: "BIDIRECTIONAL_STREAM"
} as const;
export type GrpcMethod = (typeof GrpcMethod)[keyof typeof GrpcMethod];

export const Availability = {
    Stable: "Stable",
    GenerallyAvailable: "GenerallyAvailable",
    InDevelopment: "InDevelopment",
    PreRelease: "PreRelease",
    Deprecated: "Deprecated",
    Beta: "Beta"
} as const;
export type Availability = (typeof Availability)[keyof typeof Availability];

export const SupportedLanguage = {
    Curl: "curl",
    Python: "python",
    Javascript: "javascript",
    Js: "js",
    Node: "node",
    Typescript: "typescript",
    Ts: "ts",
    Go: "go",
    Ruby: "ruby",
    Csharp: "csharp",
    Php: "php",
    Swift: "swift",
    Rust: "rust"
} as const;
export type SupportedLanguage = (typeof SupportedLanguage)[keyof typeof SupportedLanguage];

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
export type HttpSnippetLanguage = (typeof HttpSnippetLanguage)[keyof typeof HttpSnippetLanguage];

// ── Error types ────────────────────────────────────────────────────────

export interface InvalidDomainErrorBody {
    /** Value the domain should end with (i.e. docs.buildwithfern.com or dev.docs.buildwithfern.com) */
    requiredDomainSuffix: string;
}

// ── Docs types ─────────────────────────────────────────────────────────

export interface AnnouncementConfig {
    /** The text to display in the banner, using markdown. */
    text: string;
}

// ── Snippet types ──────────────────────────────────────────────────────

export type SnippetsByEndpointMethod = Partial<Record<HttpMethod, Snippet[]>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SnippetsByEndpointMethodSchema: z.ZodType<SnippetsByEndpointMethod> = z.record(
    HttpMethodSchema,
    z.array(z.unknown())
) as any;

// ── SDK types for snippets ────────────────────────────────────────────

export interface TypeScriptSdk {
    package: string;
    version: string;
}

export interface PythonSdk {
    package: string;
    version: string;
}

export interface GoSdk {
    githubRepo: string;
    version: string;
}

export interface RubySdk {
    gem: string;
    version: string;
}

export interface CsharpSdk {
    package: string;
    version: string;
}

export interface JavaSdk {
    group: string;
    artifact: string;
    version: string;
}

export interface TypeScriptSnippet {
    sdk: TypeScriptSdk;
    client: string;
}

export interface PythonSnippet {
    sdk: PythonSdk;
    async_client: string;
    sync_client: string;
}

export interface GoSnippet {
    sdk: GoSdk;
    client: string;
}

export interface RubySnippet {
    sdk: RubySdk;
    client: string;
}

export interface CsharpSnippet {
    sdk: CsharpSdk;
    client: string;
}

export interface JavaSnippet {
    sdk: JavaSdk;
    async_client: string;
    sync_client: string;
}

// ── Snippet discriminated union ───────────────────────────────────────

// ── Snippet code types (used to deserialize snippet data from DB) ────

export interface TypeScriptSnippetCode {
    client: string;
}

export interface PythonSnippetCode {
    async_client: string;
    sync_client: string;
}

export interface GoSnippetCode {
    client: string;
}

export interface RubySnippetCode {
    client: string;
}

export interface JavaSnippetCode {
    async_client: string;
    sync_client: string;
}

export interface CsharpSnippetCode {
    client: string;
}

// ── Sdk type (SdkRequest with required version) ─────────────────────

export const SdkSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("typescript"), package: z.string(), version: z.string() }),
    z.object({ type: z.literal("python"), package: z.string(), version: z.string() }),
    z.object({ type: z.literal("go"), githubRepo: z.string(), version: z.string() }),
    z.object({ type: z.literal("ruby"), gem: z.string(), version: z.string() }),
    z.object({
        type: z.literal("java"),
        group: z.string(),
        artifact: z.string(),
        version: z.string()
    }),
    z.object({ type: z.literal("csharp"), package: z.string(), version: z.string() })
]);
export type Sdk = z.infer<typeof SdkSchema>;

// ── Template type (generic template placeholder) ────────────────────
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export type Template = unknown;

export type Snippet = Snippet.Typescript | Snippet.Python | Snippet.Java | Snippet.Go | Snippet.Ruby | Snippet.Csharp;

export namespace Snippet {
    interface _Base {
        exampleIdentifier: string | undefined;
    }

    export interface Typescript extends TypeScriptSnippet, _Base {
        type: "typescript";
    }

    export interface Python extends PythonSnippet, _Base {
        type: "python";
    }

    export interface Java extends JavaSnippet, _Base {
        type: "java";
    }

    export interface Go extends GoSnippet, _Base {
        type: "go";
    }

    export interface Ruby extends RubySnippet, _Base {
        type: "ruby";
    }

    export interface Csharp extends CsharpSnippet, _Base {
        type: "csharp";
    }
}
