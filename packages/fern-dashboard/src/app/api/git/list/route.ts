import { type NextRequest, NextResponse } from "next/server";
import { parseGitUrl } from "@/app/services/git-common";
import { getGitLoader } from "@/app/services/github/getGitLoader";

interface TreeEntry {
    path: string;
    type: "blob" | "tree";
    size?: number;
    sha: string;
}

/**
 * GET /api/git/list?repoUrl=<url>&path=<optional-path>&ref=<optional-ref>
 *
 * Development-only endpoint to list files in a git repository.
 * - Lists the file tree for the repository or a specific path
 * - Optionally specify a ref (branch, tag, or commit SHA)
 *
 * Does NOT perform any write operations.
 */
export async function GET(req: NextRequest) {
    // Only allow in development
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "This endpoint is only available in development" }, { status: 403 });
    }

    const repoUrl = req.nextUrl.searchParams.get("repoUrl");
    if (!repoUrl) {
        return NextResponse.json({ error: "Missing required query parameter: repoUrl" }, { status: 400 });
    }

    const path = req.nextUrl.searchParams.get("path") ?? "";
    const ref = req.nextUrl.searchParams.get("ref");

    try {
        const parsed = parseGitUrl(repoUrl);
        if (!parsed.owner || !parsed.repo) {
            return NextResponse.json(
                {
                    error: "Invalid repo URL",
                    details: { parsed }
                },
                { status: 400 }
            );
        }

        const { owner, repo, provider } = parsed;

        // Get the appropriate loader (will use GHE auth if configured)
        const loader = await getGitLoader(repoUrl);

        // Get the authenticated Octokit client
        const octokit = await (loader as any).getOctokit();
        if (!octokit) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Failed to get authenticated client",
                    details: {
                        repoUrl,
                        owner,
                        repo,
                        provider,
                        hint: "Check that the app is installed and credentials are configured"
                    }
                },
                { status: 401 }
            );
        }

        // Get the default branch if no ref specified
        let targetRef = ref;
        if (!targetRef) {
            const repoResponse = await octokit.request("GET /repos/{owner}/{repo}", {
                owner,
                repo
            });
            targetRef = repoResponse.data.default_branch;
        }

        // Get the tree recursively
        const treeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
            owner,
            repo,
            tree_sha: targetRef,
            recursive: "true"
        });

        // Filter and format the tree entries
        let entries: TreeEntry[] = treeResponse.data.tree.map((item: any) => ({
            path: item.path,
            type: item.type as "blob" | "tree",
            size: item.size,
            sha: item.sha
        }));

        // If a path is specified, filter to only entries under that path
        if (path) {
            const normalizedPath = path.replace(/^\/|\/$/g, ""); // Remove leading/trailing slashes
            entries = entries.filter(
                (entry) => entry.path === normalizedPath || entry.path.startsWith(normalizedPath + "/")
            );
        }

        // Sort entries: directories first, then files, alphabetically
        entries.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === "tree" ? -1 : 1;
            }
            return a.path.localeCompare(b.path);
        });

        return NextResponse.json({
            success: true,
            repoUrl,
            ref: targetRef,
            path: path || "/",
            totalEntries: entries.length,
            truncated: treeResponse.data.truncated ?? false,
            entries
        });
    } catch (error: any) {
        console.error("[git/list] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to list repository contents",
                message: error?.message,
                statusCode: error?.status
            },
            { status: error?.status || 500 }
        );
    }
}
