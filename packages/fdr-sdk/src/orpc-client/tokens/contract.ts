import { oc } from "@orpc/contract";
import * as z from "zod";

// ── Input schemas ───────────────────────────────────────────────────────

export const GenerateTokenInputSchema = z.object({
    orgId: z.string(),
    scope: z.string()
});

export const RevokeTokenInputSchema = z.object({
    orgId: z.string(),
    tokenId: z.string()
});

// ── Output schemas ──────────────────────────────────────────────────────

export const GenerateTokenOutputSchema = z.object({
    token: z.string(),
    id: z.string()
});

// ── Types ───────────────────────────────────────────────────────────────

export type GenerateTokenInput = z.infer<typeof GenerateTokenInputSchema>;
export type RevokeTokenInput = z.infer<typeof RevokeTokenInputSchema>;
export type GenerateTokenOutput = z.infer<typeof GenerateTokenOutputSchema>;

// ── Contract ────────────────────────────────────────────────────────────

export const tokensContract = {
    generate: oc
        .route({ method: "POST", path: "/generate" })
        .input(GenerateTokenInputSchema)
        .output(GenerateTokenOutputSchema),

    revoke: oc.route({ method: "POST", path: "/revoke" }).input(RevokeTokenInputSchema)
};
