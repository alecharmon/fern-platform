import { oc } from "@orpc/contract";
import * as z from "zod";

// ── Enums ────────────────────────────────────────────────────────────────

export const LanguageEnumSchema = z.enum([
    "Go",
    "TypeScript",
    "Java",
    "Python",
    "Csharp",
    "Ruby",
    "Php",
    "Swift",
    "Rust"
]);
export type Language = z.infer<typeof LanguageEnumSchema>;

export const VersionBumpEnumSchema = z.enum(["MAJOR", "MINOR", "PATCH"]);
export type VersionBump = z.infer<typeof VersionBumpEnumSchema>;

// ── Input / Output schemas ───────────────────────────────────────────────

export const ComputeSemanticVersionInputSchema = z.object({
    package: z.string(),
    language: LanguageEnumSchema,
    githubRepository: z.string().optional()
});
export type ComputeSemanticVersionInput = z.infer<typeof ComputeSemanticVersionInputSchema>;

export const ComputeSemanticVersionOutputSchema = z.object({
    version: z.string(),
    bump: VersionBumpEnumSchema
});
export type ComputeSemanticVersionOutput = z.infer<typeof ComputeSemanticVersionOutputSchema>;

// ── Contract ─────────────────────────────────────────────────────────────

export const sdksContract = {
    computeSemanticVersion: oc
        .route({ method: "POST", path: "/semantic-version/compute" })
        .input(ComputeSemanticVersionInputSchema)
        .output(ComputeSemanticVersionOutputSchema)
};
