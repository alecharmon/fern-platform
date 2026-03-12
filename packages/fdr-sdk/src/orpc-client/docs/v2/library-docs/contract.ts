import { oc } from "@orpc/contract";
import * as z from "zod";

const ALLOWED_HOSTNAMES = new Set(["github.com", "gitlab.com"]);

/**
 * Validates that a URL is a valid GitHub or GitLab repository URL.
 * Only allows https://github.com/<owner>/<repo> and https://gitlab.com/<owner>/<repo> patterns.
 */
export const GithubUrlSchema = z
    .string()
    .url()
    .describe(
        "HTTPS URL of a GitHub or GitLab repository. Currently only github.com and gitlab.com are supported. Must match the pattern https://github.com/<owner>/<repo> or https://gitlab.com/<owner>/<repo>."
    )
    .refine(
        (url) => {
            try {
                const parsed = new URL(url);
                if (parsed.protocol !== "https:") {
                    return false;
                }
                if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
                    return false;
                }
                if (parsed.username || parsed.password) {
                    return false;
                }
                // Must match /<owner>/<repo> with optional .git suffix and trailing slash only.
                // Reject trailing path segments (e.g. /tree/main) to stay consistent with
                // the Python/C++ parser regex and because git-clone doesn't use them.
                return /^\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/.test(parsed.pathname);
            } catch {
                return false;
            }
        },
        { message: "Must be a valid https://github.com/<owner>/<repo> or https://gitlab.com/<owner>/<repo> URL" }
    );

/** Validates branch names against allowed characters. */
const SafeBranchSchema = z
    .string()
    .regex(/^[a-zA-Z0-9._/-]+$/, "Invalid branch name")
    .nullish();

/** Validates packagePath does not contain traversal sequences. */
const SafePackagePathSchema = z
    .string()
    .refine((p) => !p.includes("..") && !p.startsWith("/"), {
        message: "packagePath must not contain path traversal sequences"
    })
    .nullish();

export const LibraryDocsBaseConfigSchema = z.object({
    branch: SafeBranchSchema,
    packagePath: SafePackagePathSchema,
    title: z.string().nullish(),
    slug: z.string().nullish()
});

export const PythonLibraryDocsConfigSchema = LibraryDocsBaseConfigSchema;

export const CppLibraryDocsConfigSchema = LibraryDocsBaseConfigSchema.extend({
    doxyfileContent: z.string().nullish()
});

export const StartLibraryDocsGenerationInputSchema = z.discriminatedUnion("language", [
    z.object({
        orgId: z.string(),
        githubUrl: GithubUrlSchema,
        language: z.literal("PYTHON"),
        config: PythonLibraryDocsConfigSchema.nullish()
    }),
    z.object({
        orgId: z.string(),
        githubUrl: GithubUrlSchema,
        language: z.literal("CPP"),
        config: CppLibraryDocsConfigSchema.nullish()
    })
]);

export const StartLibraryDocsGenerationResponseSchema = z.object({
    jobId: z.string()
});

export const GetLibraryDocsStatusInputSchema = z.object({
    jobId: z.string()
});

export const LibraryDocsResultSchema = z.object({
    jobId: z.string(),
    resultUrl: z.string()
});

export const LibraryDocsGenerationStatusSchema = z.object({
    jobId: z.string(),
    status: z.string(),
    progress: z.string(),
    error: z
        .object({
            code: z.string(),
            message: z.string()
        })
        .optional(),
    createdAt: z.string(),
    updatedAt: z.string()
});

export const libraryDocsContract = {
    startLibraryDocsGeneration: oc
        .route({ method: "POST", path: "/library-docs/generate" })
        .input(StartLibraryDocsGenerationInputSchema)
        .output(StartLibraryDocsGenerationResponseSchema),

    getLibraryDocsGenerationStatus: oc
        .route({ method: "GET", path: "/library-docs/status/{jobId}" })
        .input(GetLibraryDocsStatusInputSchema)
        .output(LibraryDocsGenerationStatusSchema),

    getLibraryDocsResult: oc
        .route({ method: "GET", path: "/library-docs/result/{jobId}" })
        .input(GetLibraryDocsStatusInputSchema)
        .output(LibraryDocsResultSchema)
};
