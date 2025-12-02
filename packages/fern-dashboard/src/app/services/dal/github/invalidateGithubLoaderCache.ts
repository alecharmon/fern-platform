"use server";

import { revalidateTag } from "next/cache";
import { getOwnerAndRepoFromGithubUrl } from "@/app/services/github/github";
import { invalidateRepoCache } from "@/app/services/github/github-loader";

/**
 * Invalidates all cached data for a GitHub repository loader.
 * This should be called when:
 * - A repository is connected for the first time
 * - Repository configuration changes that might affect cached data
 *
 * This function clears:
 * - React cache (via revalidateTag)
 * - Next.js unstable_cache (via revalidateTag with loader tag)
 * - Individual file/commit caches (via github-repo tag)
 *
 * @param githubUrl - The GitHub repository URL (e.g., "https://github.com/owner/repo")
 */
export async function invalidateGithubLoaderCache(githubUrl: string): Promise<void> {
    // Invalidate the githubUrl cache
    revalidateTag(githubUrl);

    // Also invalidate the broader repo cache which includes commit refs, files, etc.
    const { owner, repo } = getOwnerAndRepoFromGithubUrl(githubUrl);
    if (owner && repo) {
        invalidateRepoCache(owner, repo);
    }
}
