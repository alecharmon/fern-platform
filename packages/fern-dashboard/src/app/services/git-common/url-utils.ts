export interface ParsedGitUrl {
    owner: string | null;
    repo: string | null;
    provider: "github" | "gitlab" | "unknown";
    /**
     * For GitLab, this contains the full path after the owner (including subgroups and repo).
     * For GitHub, this is the same as `repo`.
     * Example: gitlab.com/acme/team/subteam/my-repo
     *   - owner: "acme"
     *   - repo: "my-repo" (last segment)
     *   - path: "team/subteam/my-repo" (everything after owner)
     */
    path?: string | null;
}

export function parseGitUrl(url: string): ParsedGitUrl {
    // Handle empty or invalid URLs early
    if (!url || url.trim() === "") {
        return {
            owner: null,
            repo: null,
            provider: "unknown",
            path: null
        };
    }

    const lowerUrl = url.toLowerCase();

    let provider: "github" | "gitlab" | "unknown" = "unknown";
    if (lowerUrl.includes("github.com")) {
        provider = "github";
    } else if (lowerUrl.includes("gitlab.com") || lowerUrl.includes("gitlab")) {
        provider = "gitlab";
    }

    // Only parse owner/repo if we have a known provider
    const result =
        provider !== "unknown" ? getOwnerAndRepoFromUrl(url, provider) : { owner: null, repo: null, path: null };

    return {
        owner: result.owner,
        repo: result.repo,
        provider,
        path: result.path
    };
}

export function getOwnerAndRepoFromUrl(
    url: string,
    provider: "github" | "gitlab" | "unknown"
): {
    owner: string | null;
    repo: string | null;
    path: string | null;
} {
    try {
        // Handle SSH URLs
        const sshMatch = url.match(/git@[^:]+:(.+)/);
        if (sshMatch) {
            const pathStr = sshMatch[1]?.replace(/\.git$/, "") || "";
            const pathParts = pathStr.split("/").filter(Boolean);

            if (pathParts.length >= 2) {
                const owner = pathParts[0] || null;
                const repo = pathParts[pathParts.length - 1] || null;

                if (provider === "gitlab" && pathParts.length > 2) {
                    // For GitLab with nested groups: owner/group1/group2/repo
                    const path = pathParts.slice(1).join("/");
                    return { owner, repo, path };
                }

                // For GitHub or simple GitLab: owner/repo
                return { owner, repo, path: repo };
            }

            return { owner: null, repo: null, path: null };
        }

        // Handle HTTPS URLs
        const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);

        if (pathParts.length >= 2) {
            const owner = pathParts[0] || null;
            const lastSegment = pathParts[pathParts.length - 1]?.replace(/\.git$/, "") || null;
            const repo = lastSegment;

            if (provider === "gitlab" && pathParts.length > 2) {
                // For GitLab with nested groups: owner/group1/group2/repo
                // path should be everything after owner
                const path = pathParts
                    .slice(1)
                    .map((p) => p.replace(/\.git$/, ""))
                    .join("/");
                return { owner, repo, path };
            }

            // For GitHub or simple GitLab: owner/repo
            return { owner, repo, path: repo };
        }

        return { owner: null, repo: null, path: null };
    } catch (error) {
        console.error("Failed to parse git URL:", url, error);
        return { owner: null, repo: null, path: null };
    }
}

export function getOwnerAndRepoFromGithubUrl(githubUrl: string): {
    owner: string | null;
    repo: string | null;
} {
    return getOwnerAndRepoFromUrl(githubUrl, "github");
}

export function getOwnerAndRepoFromGitlabUrl(gitlabUrl: string): {
    owner: string | null;
    repo: string | null;
    path: string | null;
} {
    return getOwnerAndRepoFromUrl(gitlabUrl, "gitlab");
}

export function stripAndSanitizeUrl(url: string): string {
    try {
        let sanitized = url.replace(/^https?:\/\//i, "");

        sanitized = sanitized.replace(/^www\./i, "");

        sanitized = sanitized.replace(/\/+$/, "");

        sanitized = sanitized.toLowerCase();

        return sanitized;
    } catch (error) {
        console.error("Failed to sanitize URL:", url, error);
        return url.toLowerCase();
    }
}
