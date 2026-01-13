import { type NextRequest, NextResponse } from "next/server";
import { parseGitUrl } from "@/app/services/git-common";
import { getGitLoader } from "@/app/services/github/getGitLoader";

/**
 * GET /api/git/check?repoUrl=<url>
 *
 * Development-only endpoint to test git loader connectivity.
 * - Confirms the repo exists and can be connected to
 * - Prints out the fern sites + organizations configured for each site
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

        console.log(`[git/check] Checking repo: ${repoUrl}`);
        console.log(`[git/check] Parsed: owner=${owner}, repo=${repo}, provider=${provider}`);

        // Get the appropriate loader (will use GHE auth if configured)
        const loader = await getGitLoader(repoUrl);

        // Try to get the repository info to confirm connectivity
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

        // Fetch repository info to confirm we can connect
        let repoInfo;
        try {
            const response = await octokit.request("GET /repos/{owner}/{repo}", {
                owner,
                repo
            });
            repoInfo = {
                name: response.data.name,
                fullName: response.data.full_name,
                defaultBranch: response.data.default_branch,
                private: response.data.private,
                description: response.data.description
            };
        } catch (error: any) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Failed to fetch repository",
                    details: {
                        repoUrl,
                        owner,
                        repo,
                        provider,
                        statusCode: error?.status,
                        message: error?.message
                    }
                },
                { status: error?.status || 500 }
            );
        }

        // Try to find Fern projects in the repo
        let fernProjects: Array<{
            docsYmlPath: string;
            fernConfigJsonPath: string;
            sites: string[];
            organization?: string;
        }> = [];

        try {
            // Get the tree to find all fern.config.json files
            const treeResponse = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", {
                owner,
                repo,
                tree_sha: repoInfo.defaultBranch,
                recursive: "true"
            });

            // Find all fern.config.json files
            const fernConfigPaths = treeResponse.data.tree
                .filter(
                    (item: any) =>
                        item.type === "blob" &&
                        item.path?.endsWith("fern.config.json") &&
                        item.path?.split("/").pop() === "fern.config.json"
                )
                .map((item: any) => item.path);

            // For each fern.config.json, look for a sibling docs.yml and parse both
            for (const fernConfigPath of fernConfigPaths) {
                const fernDir = fernConfigPath.replace("/fern.config.json", "");
                const docsYmlPath = `${fernDir}/docs.yml`;

                // Check if docs.yml exists
                const docsYmlExists = treeResponse.data.tree.some(
                    (item: any) => item.type === "blob" && item.path === docsYmlPath
                );

                if (!docsYmlExists) {
                    continue;
                }

                // Fetch fern.config.json content
                let organization: string | undefined;
                try {
                    const configResponse = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                        owner,
                        repo,
                        path: fernConfigPath,
                        ref: repoInfo.defaultBranch,
                        headers: { accept: "application/vnd.github.v3.raw" }
                    });
                    const configContent = configResponse.data as unknown as string;
                    const config = JSON.parse(configContent);
                    organization = config.organization;
                } catch (error) {
                    console.warn(`[git/check] Failed to parse ${fernConfigPath}:`, error);
                }

                // Fetch docs.yml content to extract sites
                let sites: string[] = [];
                try {
                    const docsResponse = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                        owner,
                        repo,
                        path: docsYmlPath,
                        ref: repoInfo.defaultBranch,
                        headers: { accept: "application/vnd.github.v3.raw" }
                    });
                    const docsContent = docsResponse.data as unknown as string;

                    // Simple regex to extract URLs from docs.yml
                    // Matches: url: example.docs.buildwithfern.com or url: https://docs.example.com
                    const urlMatches = docsContent.match(/url:\s*["']?([^\s"'\n]+)["']?/g);
                    if (urlMatches) {
                        sites = urlMatches.map((match) => {
                            const url = match.replace(/url:\s*["']?/, "").replace(/["']$/, "");
                            return url;
                        });
                    }
                } catch (error) {
                    console.warn(`[git/check] Failed to parse ${docsYmlPath}:`, error);
                }

                fernProjects.push({
                    docsYmlPath,
                    fernConfigJsonPath: fernConfigPath,
                    sites,
                    organization
                });
            }
        } catch (error) {
            console.warn("[git/check] Failed to scan for Fern projects:", error);
        }

        return NextResponse.json({
            success: true,
            repoUrl,
            parsed: {
                owner,
                repo,
                provider
            },
            repository: repoInfo,
            fernProjects
        });
    } catch (error: any) {
        console.error("[git/check] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Internal server error",
                message: error?.message
            },
            { status: 500 }
        );
    }
}
