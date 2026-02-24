import { oc } from "@orpc/contract";
import * as z from "zod";

// ── GeneratorId branded type ─────────────────────────────────────────

export type GeneratorId = string & {
    generators_GeneratorId: void;
};

export function GeneratorId(value: string): GeneratorId {
    return value as unknown as GeneratorId;
}

// ── Shared enums / const objects ─────────────────────────────────────

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

export const ReleaseType = {
    Ga: "GA",
    Rc: "RC"
} as const;
export type ReleaseType = (typeof ReleaseType)[keyof typeof ReleaseType];

// ── Shared zod schemas ───────────────────────────────────────────────

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

export const ChangelogEntryTypeSchema = z.enum(["fix", "feat", "chore", "break", "internal"]);
export type ChangelogEntryType = z.infer<typeof ChangelogEntryTypeSchema>;

export const ChangelogEntrySchema = z.object({
    type: ChangelogEntryTypeSchema,
    summary: z.string(),
    links: z.array(z.string()).optional(),
    upgradeNotes: z.string().optional(),
    added: z.array(z.string()).optional(),
    changed: z.array(z.string()).optional(),
    deprecated: z.array(z.string()).optional(),
    removed: z.array(z.string()).optional(),
    fixed: z.array(z.string()).optional()
});
export type ChangelogEntry = z.infer<typeof ChangelogEntrySchema>;

export const YankSchema = z.object({
    remediationVerision: z.string().optional()
});
export type Yank = z.infer<typeof YankSchema>;

export const ReleaseTypeSchema = z.enum(["GA", "RC"]);

export const VersionRangeSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("inclusive"), value: z.string() }),
    z.object({ type: z.literal("exclusive"), value: z.string() })
]);
export type VersionRange = z.infer<typeof VersionRangeSchema>;

// ── Root generators schemas ──────────────────────────────────────────

export const GeneratorSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    generatorType: GeneratorTypeSchema,
    generatorLanguage: GeneratorLanguageSchema.optional(),
    dockerImage: z.string(),
    scripts: GeneratorScriptsSchema.optional()
});

export const GeneratorOutputSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    generatorType: GeneratorTypeSchema,
    generatorLanguage: GeneratorLanguageSchema.nullish(),
    dockerImage: z.string(),
    scripts: GeneratorScriptsSchema.nullish()
});

export const GetGeneratorByImageInputSchema = z.object({
    dockerImage: z.string()
});

export const GetGeneratorInputSchema = z.object({
    generatorId: z.string()
});

// ── Generator versions schemas ───────────────────────────────────────

export const GeneratorReleaseSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: YankSchema.optional(),
    changelogEntry: z.array(ChangelogEntrySchema).optional(),
    releaseType: ReleaseTypeSchema,
    majorVersion: z.number(),
    generatorId: z.string(),
    irVersion: z.number(),
    migration: z.string().optional(),
    customConfigSchema: z.string().optional(),
    tags: z.array(z.string()).optional()
});

export const GeneratorReleaseRequestSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: YankSchema.optional(),
    changelogEntry: z.array(ChangelogEntrySchema).optional(),
    generatorId: z.string(),
    irVersion: z.number(),
    migration: z.string().optional(),
    customConfigSchema: z.string().optional(),
    tags: z.array(z.string()).optional()
});

export const GetLatestGeneratorReleaseInputSchema = z.object({
    generator: z.string(),
    cliVersion: z.string().optional(),
    irVersion: z.number().optional(),
    generatorMajorVersion: z.number().optional(),
    releaseTypes: z.array(ReleaseTypeSchema).optional()
});

export const GetGeneratorChangelogInputSchema = z.object({
    generator: z.string(),
    fromVersion: VersionRangeSchema,
    toVersion: VersionRangeSchema
});

export const ChangelogResponseSchema = z.object({
    version: z.string(),
    changelogEntry: z.array(ChangelogEntrySchema)
});

export const GetChangelogResponseSchema = z.object({
    entries: z.array(ChangelogResponseSchema)
});

export const GetGeneratorReleaseInputSchema = z.object({
    generator: z.string(),
    version: z.string()
});

export const ListGeneratorReleasesInputSchema = z.object({
    generator: z.string(),
    page: z.coerce.number().optional(),
    pageSize: z.coerce.number().optional()
});

export const ListGeneratorReleasesResponseSchema = z.object({
    generatorReleases: z.array(GeneratorReleaseSchema)
});

// ── CLI schemas ──────────────────────────────────────────────────────

export const CliReleaseSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: YankSchema.optional(),
    changelogEntry: z.array(ChangelogEntrySchema).optional(),
    releaseType: ReleaseTypeSchema,
    majorVersion: z.number(),
    irVersion: z.number(),
    tags: z.array(z.string()).optional()
});

export const GetLatestCliReleaseInputSchema = z.object({
    releaseTypes: z.array(ReleaseTypeSchema).optional(),
    irVersion: z.number().optional()
});

export const GetCliChangelogInputSchema = z.object({
    fromVersion: VersionRangeSchema,
    toVersion: VersionRangeSchema
});

export const GetMinCliForIrInputSchema = z.object({
    irVersion: z.coerce.number()
});

export const UpsertCliReleaseInputSchema = z.object({
    version: z.string(),
    createdAt: z.string().optional(),
    isYanked: YankSchema.optional(),
    changelogEntry: z.array(ChangelogEntrySchema).optional(),
    irVersion: z.number(),
    tags: z.array(z.string()).optional()
});

export const GetCliReleaseInputSchema = z.object({
    cliVersion: z.string()
});

export const ListCliReleasesInputSchema = z.object({
    page: z.coerce.number().optional(),
    pageSize: z.coerce.number().optional()
});

export const ListCliReleasesResponseSchema = z.object({
    cliReleases: z.array(CliReleaseSchema)
});

// ── Contracts ────────────────────────────────────────────────────────

export const generatorsContract = {
    upsertGenerator: oc.route({ method: "PUT", path: "/" }).input(GeneratorSchema).output(z.void()),

    getGeneratorByImage: oc
        .route({ method: "POST", path: "/by-image" })
        .input(GetGeneratorByImageInputSchema)
        .output(GeneratorOutputSchema.optional()),

    getGenerator: oc
        .route({ method: "GET", path: "/{generatorId}" })
        .input(GetGeneratorInputSchema)
        .output(GeneratorOutputSchema.optional()),

    listGenerators: oc.route({ method: "GET", path: "/" }).input(z.object({})).output(z.array(GeneratorOutputSchema))
};

export const generatorVersionsContract = {
    getLatestGeneratorRelease: oc
        .route({ method: "POST", path: "/latest" })
        .input(GetLatestGeneratorReleaseInputSchema)
        .output(GeneratorReleaseSchema),

    getChangelog: oc
        .route({ method: "POST", path: "/{generator}/changelog" })
        .input(GetGeneratorChangelogInputSchema)
        .output(GetChangelogResponseSchema),

    upsertGeneratorRelease: oc
        .route({ method: "PUT", path: "/" })
        .input(GeneratorReleaseRequestSchema)
        .output(z.void()),

    getGeneratorRelease: oc
        .route({ method: "GET", path: "/{generator}/{version}" })
        .input(GetGeneratorReleaseInputSchema)
        .output(GeneratorReleaseSchema),

    listGeneratorReleases: oc
        .route({ method: "GET", path: "/{generator}" })
        .input(ListGeneratorReleasesInputSchema)
        .output(ListGeneratorReleasesResponseSchema)
};

export const generatorCliContract = {
    getLatestCliRelease: oc
        .route({ method: "POST", path: "/latest" })
        .input(GetLatestCliReleaseInputSchema)
        .output(CliReleaseSchema),

    getChangelog: oc
        .route({ method: "POST", path: "/changelog" })
        .input(GetCliChangelogInputSchema)
        .output(GetChangelogResponseSchema),

    getMinCliForIr: oc
        .route({ method: "GET", path: "/for-ir/{irVersion}" })
        .input(GetMinCliForIrInputSchema)
        .output(CliReleaseSchema),

    upsertCliRelease: oc.route({ method: "PUT", path: "/" }).input(UpsertCliReleaseInputSchema).output(z.void()),

    getCliRelease: oc
        .route({ method: "GET", path: "/{cliVersion}" })
        .input(GetCliReleaseInputSchema)
        .output(CliReleaseSchema),

    listCliReleases: oc
        .route({ method: "GET", path: "/" })
        .input(ListCliReleasesInputSchema)
        .output(ListCliReleasesResponseSchema)
};
