import type {
    ComputeSemanticVersionInputSchema,
    ComputeSemanticVersionOutputSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import semver from "semver";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import { getExistingVersion } from "./getVersionsService";

export function createComputeSemanticVersionRouter(_app: FdrApplication) {
    const computeSemanticVersion = os
        .route({ method: "POST", path: "/semantic-version/compute" })
        .input(z.custom<z.infer<typeof ComputeSemanticVersionInputSchema>>())
        .output(z.custom<z.infer<typeof ComputeSemanticVersionOutputSchema>>())
        .handler(async ({ input }) => {
            const existingVersion = await getExistingVersion({
                githubRepository: input.githubRepository ?? undefined,
                packageName: input.package,
                language: input.language
            });
            if (existingVersion == null) {
                throw new ORPCError("BAD_REQUEST");
            }

            const nextVersion = semver.inc(existingVersion, "patch");
            if (nextVersion == null) {
                throw new ORPCError("INTERNAL_SERVER_ERROR");
            }

            return {
                version: nextVersion,
                bump: "PATCH" as const
            };
        });

    return { computeSemanticVersion };
}
