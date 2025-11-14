import { cache } from "react";
import type { DocsUrl } from "@/utils/types";
import { GitHubLoader } from "./github-loader";

export const getCachedGitHubLoader = cache(async (githubUrl: string) => {
    const loader = new GitHubLoader({ githubUrl });

    return {
        getDocsYml: cache(
            async (owner: string, repo: string, site: DocsUrl, ref?: string, preferDefaultBranch?: boolean) => {
                return loader.getDocsYml(owner, repo, site, ref, preferDefaultBranch);
            }
        ),
        getDocsYmlAndReferences: cache(
            async (owner: string, repo: string, site: DocsUrl, ref?: string, preferDefaultBranch?: boolean) => {
                return loader.getDocsYmlAndReferences(owner, repo, site, ref, preferDefaultBranch);
            }
        ),
        getFernConfigJson: cache(async (owner: string, repo: string, site: DocsUrl) => {
            return loader.getFernConfigJson(owner, repo, site);
        }),
        getFernProjectBySite: cache(async (owner: string, repo: string, site: DocsUrl) => {
            return loader.getFernProjectBySite(owner, repo, site);
        }),
        getOctokit: cache(async () => {
            return loader.getOctokit();
        })
    };
});
