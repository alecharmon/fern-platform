import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuthNextRoute } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import type { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace postGitCommit {
    export type Request = z.infer<typeof PostGitCommitRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

export const PostGitCommitRequest = GithubIdentificationScheme.and(
    z.object({
        orgName: orgNameValidator,
        owner: z.string(),
        repo: z.string(),
        branch: z.string(),
        message: z.string(),
        files: z.array(
            z.discriminatedUnion("delete", [
                z.object({
                    path: z.string(),
                    delete: z.literal(true),
                    // 100644 is normal file, 100755 is executable file, 040000 is directory, 160000 is symlink, 120000 is submodule
                    mode: z.enum(["100644", "100755", "040000", "160000", "120000"]).optional()
                }),
                z.object({
                    path: z.string(),
                    content: z.string(),
                    // 100644 is normal file, 100755 is executable file, 040000 is directory, 160000 is symlink, 120000 is submodule
                    mode: z.enum(["100644", "100755", "040000", "160000", "120000"]).optional(),
                    delete: z.literal(false).optional()
                })
            ])
        )
    })
);

export const POST = withZodValidation(
    PostGitCommitRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof PostGitCommitRequest>) => {
        const { orgName, branch, message, files, ...repoData } = validatedBody;

        return withGithubAuthNextRoute(req, orgName, repoData, async ({ owner, repo }) => {
            const result = await handler({
                owner,
                repo,
                branch,
                message,
                files
            });
            return NextResponse.json(result);
        });
    }
);
