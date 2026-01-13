import "server-only";

import type { FernConfigJsonErrors } from "@fern-api/docs-loader";

import { parseGitUrl } from "@/app/services/git-common/url-utils";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import type { DocsUrl } from "@/utils/types";

export type GetFernVersionFromRepoError =
    | { type: "MALFORMED_GIT_URL"; url: string }
    | { type: "FERN_BOT_NOT_INSTALLED" }
    | FernConfigJsonErrors;

export type GetFernVersionFromRepoResult =
    | { ok: true; version: string }
    | { ok: false; error: GetFernVersionFromRepoError };

export async function getFernVersionFromRepo(repoUrl: string, docsUrl: DocsUrl): Promise<GetFernVersionFromRepoResult> {
    const parsed = parseGitUrl(repoUrl);
    const isGitLab = parsed.provider === "gitlab";

    // For GitLab, use the full path; for GitHub, use repo
    const repoOrPath = isGitLab ? (parsed.path ?? parsed.repo) : parsed.repo;

    if (parsed.owner == null || repoOrPath == null) {
        return {
            ok: false,
            error: { type: "MALFORMED_GIT_URL", url: repoUrl }
        };
    }

    const loader = await getGitLoader(repoUrl);
    const fernConfigResult = await loader.getFernConfigJson(parsed.owner, repoOrPath, docsUrl);

    if (fernConfigResult.type !== "ok") {
        return {
            ok: false,
            error: fernConfigResult.error
        };
    }

    return { ok: true, version: fernConfigResult.result.version };
}
