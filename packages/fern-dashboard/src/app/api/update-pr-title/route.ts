import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { orgNameValidator } from "@/app/api/utils/validators";
import { withGithubAuthNextRoute } from "@/app/services/dal/github/middleware";
import { GithubIdentificationScheme } from "@/app/services/dal/github/types";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { ResolvedReturnType } from "@/utils/types";

import handler from "./handler";

export declare namespace updatePrTitle {
    export type Request = z.infer<typeof UpdatePrTitleRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

export const UpdatePrTitleRequest = GithubIdentificationScheme.and(
    z.object({
        orgName: orgNameValidator,
        branch: z.string(),
        title: z.string(),
        baseBranch: z.string().optional()
    })
);

export const POST = withZodValidation(
    UpdatePrTitleRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof UpdatePrTitleRequest>) => {
        const { orgName, branch, title, baseBranch, ...repoData } = validatedBody;

        return withGithubAuthNextRoute(req, orgName, repoData, async ({ owner, repo }) => {
            const result = await handler({
                owner,
                repo,
                branch,
                title,
                baseBranch
            });
            return NextResponse.json(result);
        });
    }
);
