import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { setFernTokenSecret } from "@/app/services/dal/github/setFernTokenSecret";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { RedisCacheKey } from "@/app/services/redis/cacheKey";
import { redisSet } from "@/app/services/redis/redis";
import { getDocsStarterTemplateFiles, type TemplateFile } from "@/templates/docs-starter";
import { fernCliConfig } from "@/utils/fernCliConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SetUpRepoRequest {
    orgName: string;
}

/**
 * Check if a GitHub repository exists
 */
async function repoExists(owner: string, repoName: string): Promise<boolean> {
    const octokitResult = getDemoCreationBotOctokit();
    if (!octokitResult.ok) {
        return false;
    }

    try {
        await octokitResult.octokit.request("GET /repos/{owner}/{repo}", {
            owner,
            repo: repoName
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Generate a random 6-digit number string
 */
function generateRandomSuffix(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Find an available repo name, appending random suffix if needed
 */
async function findAvailableRepoName(owner: string, baseRepoName: string): Promise<string> {
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const repoName = attempt === 0 ? baseRepoName : `${baseRepoName}-${generateRandomSuffix()}`;

        const exists = await repoExists(owner, repoName);
        if (!exists) {
            return repoName;
        }

        console.log(`[set-up-repo] Repo ${repoName} already exists, trying another name...`);
    }

    throw new Error(`Could not find available repo name after ${maxAttempts} attempts`);
}

/**
 * Converts template files to repository files format
 */
function toRepositoryFiles(
    templateFiles: TemplateFile[]
): Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }> {
    return templateFiles.map((file) => ({
        path: file.path,
        content: file.content,
        encoding: file.encoding
    }));
}

/**
 * POST /api/onboarding-docs/set-up-repo
 *
 * Creates a new GitHub repository with vanilla docs-starter content and sets FERN_TOKEN.
 * This is step 1 of the two-step onboarding process.
 *
 * Request body:
 * - orgName: string - The organization name (used for repo naming and fern config)
 *
 * Response:
 * - success: boolean
 * - repoName: string - The created repository name
 * - githubRepoUrl: string - The GitHub URL of the created repository
 */
export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: SetUpRepoRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.orgName) {
        return NextResponse.json({ error: "orgName is required" }, { status: 400 });
    }

    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
    if (!demoCreationBotOwner) {
        console.error("[set-up-repo] FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let tempDir: string | null = null;

    try {
        // Create temp directory for fern token generation
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-setup-repo-"));
        const fernDir = path.join(tempDir, "fern");
        await fs.mkdir(fernDir, { recursive: true });

        // Get template files
        const templateFiles = await getDocsStarterTemplateFiles();

        // Write fern.config.json to temp dir (needed for fern token command)
        await fs.writeFile(
            path.join(fernDir, "fern.config.json"),
            JSON.stringify({ organization: data.orgName, version: "*" }, null, 2)
        );

        // Generate a temporary docs.yml for token generation
        const baseRepoName = data.orgName.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        const docsUrl = `${baseRepoName}.${fernCliConfig.docsDomain}`;
        await fs.writeFile(path.join(fernDir, "docs.yml"), `instances:\n  - url: ${docsUrl}\n\ntitle: Documentation\n`);

        // Find an available repo name
        const repoName = await findAvailableRepoName(demoCreationBotOwner, baseRepoName);

        console.log(`[set-up-repo] Creating repo ${demoCreationBotOwner}/${repoName}`);

        // Prepare files for the repository
        const repoFiles = toRepositoryFiles(templateFiles);

        // Get GitLoader with demo bot credentials
        const repoUrl = `https://github.com/${demoCreationBotOwner}/${repoName}`;
        const loader = await getGitLoader(repoUrl, true);

        // Create repository with all template files
        const result = await loader.createRepository?.({
            owner: demoCreationBotOwner,
            repoName,
            description: `Documentation for ${data.orgName}`,
            isPrivate: true,
            files: repoFiles
        });

        if (!result || result.type !== "ok") {
            const errorMsg = result?.type === "error" ? result.error.message : "createRepository not available";
            throw new Error(`Failed to create repository: ${errorMsg}`);
        }

        console.log(`[set-up-repo] Repository created: ${result.htmlUrl}`);

        // Store repo info in Redis for add-collaborator security check
        // This allows the add-repo-collaborator endpoint to verify the repo was created for this org
        try {
            await redisSet(
                RedisCacheKey.onboardingPreCreate(data.orgName),
                {
                    status: "completed",
                    repoName,
                    repoUrl: result.htmlUrl,
                    startedAt: Date.now(),
                    completedAt: Date.now()
                },
                { ttlInSeconds: 60 * 60 } // 1 hour TTL
            );
            console.log(`[set-up-repo] Cached repo info for org ${data.orgName}`);
        } catch (cacheError) {
            // Non-fatal: collaborator feature won't work but repo creation succeeded
            console.warn("[set-up-repo] Failed to cache repo info:", cacheError);
        }

        // Set FERN_TOKEN as GitHub secret
        let fernTokenSet = false;
        try {
            const tokenResult = await setFernTokenSecret({
                owner: demoCreationBotOwner,
                repoName,
                workingDir: tempDir,
                fernToken: session.accessToken
            });

            if (tokenResult.success) {
                fernTokenSet = true;
                console.log(`[set-up-repo] FERN_TOKEN set successfully for ${repoName}`);
            } else {
                console.warn(`[set-up-repo] Failed to set FERN_TOKEN: ${tokenResult.error?.message}`);
            }
        } catch (tokenError) {
            console.warn("[set-up-repo] Error setting FERN_TOKEN:", tokenError);
        }

        return NextResponse.json({
            success: true,
            repoName,
            githubRepoUrl: result.htmlUrl,
            fernTokenSet
        });
    } catch (error) {
        console.error("[set-up-repo] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create repository" },
            { status: 500 }
        );
    } finally {
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("[set-up-repo] Failed to cleanup temp directory:", cleanupError);
            }
        }
    }
}
