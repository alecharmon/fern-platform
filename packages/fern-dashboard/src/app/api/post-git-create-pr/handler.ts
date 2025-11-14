import type { GitOperationError } from "@fern-api/docs-loader";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getGitLoaderByOwnerRepo } from "@/app/services/github/getGitLoader";

export type PostCreatePrErrors = GitOperationError | { type: "NOT_LOGGED_IN" };

export default async function postCreatePr(request: {
    owner: string;
    repo: string;
    head: string;
    base: string;
    title: string;
    body?: string;
    draft?: boolean;
}): Promise<
    | {
          success: true;
          prUrl: string;
          prNumber: number;
      }
    | {
          success: false;
          error: PostCreatePrErrors;
      }
> {
    // 1. Check user session
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: { type: "NOT_LOGGED_IN" } };
    }

    // 2. Get GitLoader instance
    const loader = getGitLoaderByOwnerRepo(request.owner, request.repo);

    // 3. Perform git operation
    const result = await loader.createPullRequest?.({
        owner: request.owner,
        repo: request.repo,
        head: request.head,
        base: request.base,
        title: request.title,
        body: request.body,
        draft: request.draft
    });

    if (!result) {
        return {
            success: false,
            error: { type: "UNKNOWN_ERROR", message: "createPullRequest method not available on loader" }
        };
    }

    if (result.type === "ok") {
        return { success: true, prUrl: result.prUrl, prNumber: result.prNumber };
    } else {
        return { success: false, error: result.error };
    }
}
