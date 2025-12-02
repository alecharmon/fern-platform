import { unstable_cache } from "next/cache";
import type { DocsUrl } from "@/utils/types";
import { GitHubLoader } from "./github-loader";

export const getCachedGitHubLoader = async (githubUrl: string) => {
    const loader = new GitHubLoader({ githubUrl });

    return {
        getDocsYml: unstable_cache(
            async (owner: string, repo: string, site: DocsUrl, ref?: string, preferDefaultBranch?: boolean) => {
                return loader.getDocsYml(owner, repo, site, ref, preferDefaultBranch);
            },
            [githubUrl],
            { revalidate: 60 } // 1 minute
        ),
        // DEV NOTE: When this was wrapped in an unstable_cache, the object Map was getting serialized into an object,
        // and causing downstream issues within the NavigationStore file. In order to cache this, we will need to ensure
        // that all references to the docsYml are deserialized into a Map within the NavigationStore. For now, we will leave
        // this uncached, as it is only called one time within the EditorProvidersWrapper.
        getDocsYmlAndReferences: async (
            owner: string,
            repo: string,
            site: DocsUrl,
            ref?: string,
            preferDefaultBranch?: boolean
        ) => {
            return loader.getDocsYmlAndReferences(owner, repo, site, ref, preferDefaultBranch);
        },
        getFernConfigJson: unstable_cache(
            async (owner: string, repo: string, site: DocsUrl) => {
                return loader.getFernConfigJson(owner, repo, site);
            },
            [githubUrl],
            { revalidate: 60 } // 1 minute
        ),
        getFernProjectBySite: unstable_cache(
            async (owner: string, repo: string, site: DocsUrl) => {
                return loader.getFernProjectBySite(owner, repo, site);
            },
            [githubUrl],
            { revalidate: 60 } // 1 minute
        ),
        getOctokit: unstable_cache(
            async () => {
                return loader.getOctokit();
            },
            [githubUrl],
            { revalidate: 60 * 60 } // 1 hour
        )
    };
};

/**
 * Get an uncached GitHub loader. Use this when you need fresh data and want to bypass
 * React's cache, such as when retrying after an error or validating changes.
 */
export async function getUncachedGitHubLoader(githubUrl: string) {
    const loader = new GitHubLoader({ githubUrl }, "fern-bot", true);

    return {
        getDocsYml: async (owner: string, repo: string, site: DocsUrl, ref?: string, preferDefaultBranch?: boolean) => {
            return loader.getDocsYml(owner, repo, site, ref, preferDefaultBranch);
        },
        getDocsYmlAndReferences: async (
            owner: string,
            repo: string,
            site: DocsUrl,
            ref?: string,
            preferDefaultBranch?: boolean
        ) => {
            return loader.getDocsYmlAndReferences(owner, repo, site, ref, preferDefaultBranch);
        },
        getFernConfigJson: async (owner: string, repo: string, site: DocsUrl) => {
            return loader.getFernConfigJson(owner, repo, site);
        },
        getFernProjectBySite: async (owner: string, repo: string, site: DocsUrl) => {
            return loader.getFernProjectBySite(owner, repo, site);
        },
        getOctokit: async () => {
            return loader.getOctokit();
        }
    };
}
