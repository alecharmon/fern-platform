import "server-only";

export interface ParsedGitUrl {
    owner: string | null;
    repo: string | null;
    provider: "github" | "gitlab" | "unknown";
}

export function parseGitUrl(url: string): ParsedGitUrl {
    // Handle empty or invalid URLs early
    if (!url || url.trim() === "") {
        return {
            owner: null,
            repo: null,
            provider: "unknown"
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
    const result = provider !== "unknown" ? getOwnerAndRepoFromUrl(url, provider) : { owner: null, repo: null };

    return {
        owner: result.owner,
        repo: result.repo,
        provider
    };
}

export function getOwnerAndRepoFromUrl(
    url: string,
    provider: "github" | "gitlab"
): {
    owner: string | null;
    repo: string | null;
} {
    try {
        const sshMatch = url.match(/git@[^:]+:([^/]+)\/([^/.]+)/);
        if (sshMatch) {
            return {
                owner: sshMatch[1] || null,
                repo: sshMatch[2] || null
            };
        }

        const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);

        if (pathParts.length >= 2) {
            return {
                owner: pathParts[0] || null,
                repo: pathParts[1]?.replace(/\.git$/, "") || null
            };
        }

        return { owner: null, repo: null };
    } catch (error) {
        console.error("Failed to parse git URL:", url, error);
        return { owner: null, repo: null };
    }
}

export function getOwnerAndRepoFromGithubUrl(gitUrl: string): {
    owner: string | null;
    repo: string | null;
} {
    return getOwnerAndRepoFromUrl(gitUrl, "github");
}

export function getOwnerAndRepoFromGitlabUrl(gitlabUrl: string): {
    owner: string | null;
    repo: string | null;
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
