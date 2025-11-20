import "server-only";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getDocsGithubUrl } from "@/app/services/dal/github/getDocsGithubUrl";
import type { DocsUrl } from "@/utils/types";
import { GithubSourceClient } from "./GithubSourceClient";

/**
 * Async wrapper component for GithubSourceClient that handles the fetching of
 * the GitHub URL to pass to our display component.
 */
export async function GithubSource({ docsUrl }: { docsUrl: DocsUrl }) {
    const session = await getCurrentSession();
    if (session == null) {
        return null;
    }
    const githubUrlResult = await getDocsGithubUrl(docsUrl, session?.accessToken);

    return (
        <GithubSourceClient
            docsUrl={docsUrl}
            githubUrl={githubUrlResult.success ? githubUrlResult.githubUrl : undefined}
        />
    );
}
