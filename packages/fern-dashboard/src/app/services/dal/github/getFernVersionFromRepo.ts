import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import type { DocsUrl } from "@/utils/types";

import { GitHubLoader } from "../../github/github-loader";

export type GetFernVersionFromRepoError =
    | { type: "MALFORMED_GITHUB_URL"; url: string }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | FernConfigJsonErrors;

export type GetFernVersionFromRepoResult =
    | { ok: true; version: string }
    | { ok: false; error: GetFernVersionFromRepoError };

export async function getFernVersionFromRepo(
    githubUrl: string,
    docsUrl: DocsUrl
): Promise<GetFernVersionFromRepoResult> {
    const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
    if (owner == null || repo == null) {
        return {
            ok: false,
            error: { type: "MALFORMED_GITHUB_URL", url: githubUrl }
        };
    }

    const loader = new GitHubLoader(githubUrl);
    const fernConfigResult = await loader.getFernConfigJson(owner, repo, docsUrl);

    if (fernConfigResult.type !== "ok") {
        return {
            ok: false,
            error: fernConfigResult.error
        };
    }

    return { ok: true, version: fernConfigResult.result.version };
}
