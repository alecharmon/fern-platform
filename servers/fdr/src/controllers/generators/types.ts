import * as z from "zod";

export type GeneratorId = string & {
    generators_GeneratorId: void;
};

export function GeneratorId(value: string): GeneratorId {
    return value as unknown as GeneratorId;
}

export const GeneratorLanguage = {
    Python: "python",
    Go: "go",
    Java: "java",
    Typescript: "typescript",
    Ruby: "ruby",
    Csharp: "csharp",
    Php: "php",
    Swift: "swift",
    Rust: "rust"
} as const;
export type GeneratorLanguage = (typeof GeneratorLanguage)[keyof typeof GeneratorLanguage];

export const GeneratorLanguageSchema = z.enum([
    "python",
    "go",
    "java",
    "typescript",
    "ruby",
    "csharp",
    "php",
    "swift",
    "rust"
]);

export const ScriptSchema = z.object({
    steps: z.array(z.string())
});
export type Script = z.infer<typeof ScriptSchema>;

export const GeneratorScriptsSchema = z.object({
    preInstallScript: ScriptSchema.nullish(),
    installScript: ScriptSchema.nullish(),
    compileScript: ScriptSchema.nullish(),
    testScript: ScriptSchema.nullish()
});
export type GeneratorScripts = z.infer<typeof GeneratorScriptsSchema>;

export const GeneratorTypeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("sdk") }),
    z.object({ type: z.literal("model") }),
    z.object({ type: z.literal("server") }),
    z.object({ type: z.literal("other") })
]);
export type GeneratorType = z.infer<typeof GeneratorTypeSchema>;

export const GeneratorSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    generatorType: GeneratorTypeSchema,
    generatorLanguage: GeneratorLanguageSchema.nullish(),
    dockerImage: z.string(),
    scripts: GeneratorScriptsSchema.nullish()
});
export type Generator = {
    id: GeneratorId;
    displayName: string;
    generatorType: GeneratorType;
    generatorLanguage: GeneratorLanguage | undefined;
    dockerImage: string;
    scripts: GeneratorScripts | undefined;
};

export const ChangelogEntryTypeSchema = z.enum(["fix", "feat", "chore", "break", "internal"]);
export type ChangelogEntryType = z.infer<typeof ChangelogEntryTypeSchema>;

export const ChangelogEntrySchema = z.object({
    type: ChangelogEntryTypeSchema,
    summary: z.string(),
    links: z.array(z.string()).nullish(),
    upgradeNotes: z.string().nullish(),
    added: z.array(z.string()).nullish(),
    changed: z.array(z.string()).nullish(),
    deprecated: z.array(z.string()).nullish(),
    removed: z.array(z.string()).nullish(),
    fixed: z.array(z.string()).nullish()
});
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;

export const YankSchema = z.object({
    remediationVerision: z.string().nullish()
});
export type Yank = z.infer<typeof YankSchema>;

export const ReleaseType = {
    Ga: "GA",
    Rc: "RC"
} as const;
export type ReleaseType = (typeof ReleaseType)[keyof typeof ReleaseType];

export const ReleaseTypeSchema = z.enum(["GA", "RC"]);

export const VersionRangeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("inclusive"), value: z.string() }),
    z.object({ type: z.literal("exclusive"), value: z.string() })
]);
export type VersionRange = z.infer<typeof VersionRangeSchema>;

export interface GetChangelogRequest {
    fromVersion: VersionRange;
    toVersion: VersionRange;
}

export interface GetChangelogResponse {
    entries: ChangelogResponse[];
}

export interface ChangelogResponse {
    version: string;
    changelogEntry: ChangelogEntry[];
}

export interface ReleaseRequest {
    version: string;
    createdAt: string | undefined;
    isYanked: Yank | undefined;
    changelogEntry: ChangelogEntry[] | undefined;
}

export interface Release extends ReleaseRequest {
    releaseType: ReleaseType;
    majorVersion: number;
}

export interface BaseGeneratorRelease {
    generatorId: GeneratorId;
    irVersion: number;
    migration: string | undefined;
    customConfigSchema: string | undefined;
    tags: string[] | undefined;
}

export interface GeneratorRelease extends Release, BaseGeneratorRelease {}

export interface GeneratorReleaseRequest extends ReleaseRequest, BaseGeneratorRelease {}

export interface ListGeneratorReleasesResponse {
    generatorReleases: GeneratorRelease[];
}

export interface GetLatestGeneratorReleaseRequest {
    generator: GeneratorId;
    cliVersion?: string;
    irVersion?: number;
    generatorMajorVersion?: number;
    releaseTypes?: ReleaseType[];
}

export interface BaseCliRelease {
    irVersion: number;
    tags: string[] | undefined;
}

export interface CliRelease extends Release, BaseCliRelease {}

export interface CliReleaseRequest extends ReleaseRequest, BaseCliRelease {}

export interface ListCliReleasesResponse {
    cliReleases: CliRelease[];
}

export interface GetLatestCliReleaseRequest {
    releaseTypes?: ReleaseType[];
    irVersion?: number;
}

export interface InvalidVersionErrorMessage {
    providedVersion: string;
}

export class InvalidVersionError extends Error {
    public readonly body: InvalidVersionErrorMessage;

    constructor(body: InvalidVersionErrorMessage) {
        super("InvalidVersionError");
        this.body = body;
        Object.setPrototypeOf(this, InvalidVersionError.prototype);
    }
}
