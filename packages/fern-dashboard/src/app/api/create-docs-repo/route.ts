import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { type NextRequest, NextResponse } from "next/server";
import { extract } from "tar";

import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getUserGithubUsername } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import postGitRepository from "@/app/services/dal/github/postGitRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateDocsRepoRequest {
    orgName: string;
    urlPrefix: string; // The subdomain prefix (e.g., "my-company" for my-company.docs.buildwithfern.com)
    templateId: "classic" | "minimal" | "products" | "no-top-bar";
    primaryColorHex?: string;
    fonts?: {
        headings?: string;
        body?: string;
        code?: string;
    };
}

/**
 * Checks if a file is binary based on its extension
 */
function isBinaryFile(filePath: string): boolean {
    const binaryExtensions = new Set([
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".ico",
        ".bmp",
        ".webp",
        ".tiff",
        ".tif",
        ".pdf",
        ".zip",
        ".tar",
        ".gz",
        ".woff",
        ".woff2",
        ".ttf",
        ".eot",
        ".otf"
    ]);
    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.has(ext);
}

async function readAllFilesFromDirectory(
    dirPath: string
): Promise<Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>> {
    const files: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }> = [];
    const excludePatterns = [".git", "node_modules", ".DS_Store", ".claude"];

    async function readDir(currentPath: string, relativePath = "") {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            if (excludePatterns.includes(entry.name)) {
                continue;
            }

            const fullPath = path.join(currentPath, entry.name);
            const relPath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                await readDir(fullPath, relPath);
            } else {
                if (isBinaryFile(fullPath)) {
                    const buffer = await fs.readFile(fullPath);
                    files.push({ path: relPath, content: buffer.toString("base64"), encoding: "base64" });
                } else {
                    const content = await fs.readFile(fullPath, "utf-8");
                    files.push({ path: relPath, content });
                }
            }
        }
    }

    await readDir(dirPath);
    return files;
}

async function customizeTemplate(data: CreateDocsRepoRequest, projectDir: string): Promise<void> {
    const fernDir = path.join(projectDir, "fern");

    // Update fern.config.json with org name
    const fernConfigPath = path.join(fernDir, "fern.config.json");
    const fernConfig = JSON.parse(await fs.readFile(fernConfigPath, "utf-8"));
    fernConfig.organization = data.orgName;
    await fs.writeFile(fernConfigPath, JSON.stringify(fernConfig, null, 2));

    // Load and update docs.yml
    const docsYmlPath = path.join(fernDir, "docs.yml");
    const docsYmlContent = await fs.readFile(docsYmlPath, "utf-8");
    const docsConfig = yaml.load(docsYmlContent) as Record<string, unknown>;

    // Set the site URL using the user-provided URL prefix
    const docsConfigAny = docsConfig as any;
    if (!docsConfigAny.instances) {
        docsConfigAny.instances = [];
    }
    // Replace or add the first instance with the correct URL
    if (docsConfigAny.instances.length > 0) {
        docsConfigAny.instances[0].url = `${data.urlPrefix}.docs.buildwithfern.com`;
    } else {
        docsConfigAny.instances.push({ url: `${data.urlPrefix}.docs.buildwithfern.com` });
    }

    // Add colors if provided
    if (data.primaryColorHex) {
        docsConfigAny.colors = {
            ...docsConfigAny.colors,
            "accent-primary": {
                dark: data.primaryColorHex,
                light: data.primaryColorHex
            }
        };
    }

    // Add typography/fonts if provided
    if (data.fonts) {
        const typography: Record<string, { name: string }> = {};

        if (data.fonts.headings && data.fonts.headings !== "default") {
            typography.headingsFont = { name: data.fonts.headings };
        }
        if (data.fonts.body && data.fonts.body !== "default") {
            typography.bodyFont = { name: data.fonts.body };
        }
        if (data.fonts.code && data.fonts.code !== "default") {
            typography.codeFont = { name: data.fonts.code };
        }

        if (Object.keys(typography).length > 0) {
            docsConfigAny.typography = typography;
        }
    }

    // Write updated docs.yml
    await fs.writeFile(
        docsYmlPath,
        `# yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json\n\n${yaml.dump(docsConfig)}`
    );

    // Create GitHub Actions workflow to auto-publish docs on push
    const workflowDir = path.join(projectDir, ".github", "workflows");
    await fs.mkdir(workflowDir, { recursive: true });

    const publishWorkflow = `name: Publish Docs

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Fern
        run: npm install -g fern-api

      - name: Publish Docs
        env:
          FERN_TOKEN: \${{ secrets.FERN_TOKEN }}
        run: fern generate --docs
`;

    await fs.writeFile(path.join(workflowDir, "publish-docs.yml"), publishWorkflow);
}

export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let data: CreateDocsRepoRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Validate required fields
    if (!data.orgName || !data.templateId || !data.urlPrefix) {
        return NextResponse.json({ error: "orgName, urlPrefix, and templateId are required" }, { status: 400 });
    }

    // Validate urlPrefix format (subdomain rules)
    const urlPrefixRegex = /^[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]$|^[a-z0-9]$/;
    if (!urlPrefixRegex.test(data.urlPrefix)) {
        return NextResponse.json({ error: "Invalid URL prefix format" }, { status: 400 });
    }

    // Validate templateId
    const validTemplates = ["classic", "minimal", "products", "no-top-bar"];
    if (!validTemplates.includes(data.templateId)) {
        return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    let tempDir: string | null = null;

    try {
        // Create temp directory
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-docs-repo-"));

        // Download docs-templates repo tarball
        const tarballUrl = "https://github.com/fern-api/docs-templates/archive/refs/heads/main.tar.gz";
        const response = await fetch(tarballUrl);

        if (!response.ok) {
            throw new Error(`Failed to download templates: ${response.statusText}`);
        }

        const tarballPath = path.join(tempDir, "templates.tar.gz");
        const tarballBuffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(tarballPath, tarballBuffer);

        // Extract tarball
        const extractDir = path.join(tempDir, "extracted");
        await fs.mkdir(extractDir, { recursive: true });
        await extract({ file: tarballPath, cwd: extractDir });
        await fs.unlink(tarballPath);

        // Find the extracted folder (docs-templates-main or similar)
        const extractedContents = await fs.readdir(extractDir);
        const repoFolder = extractedContents.find((f) => f.startsWith("docs-templates"));
        if (!repoFolder) {
            throw new Error("Could not find extracted template folder");
        }

        // Copy selected template to project directory
        const templateSrc = path.join(extractDir, repoFolder, data.templateId);
        const projectDir = path.join(tempDir, "project");

        try {
            await fs.access(templateSrc);
        } catch {
            throw new Error(`Template '${data.templateId}' not found in repository`);
        }

        await fs.cp(templateSrc, projectDir, { recursive: true });

        // Customize the template (update org name, colors, fonts)
        await customizeTemplate(data, projectDir);

        // Read all files from the project directory
        const files = await readAllFilesFromDirectory(projectDir);

        // Generate repo name from URL prefix (e.g., "my-company" becomes "my-company-docs")
        const repoName = `${data.urlPrefix}-docs`.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;

        if (!demoCreationBotOwner) {
            throw new Error("FERN_DEMO_CREATION_BOT_OWNER environment variable not set");
        }

        // Create GitHub repository and automatically set FERN_TOKEN secret
        console.log(`Creating GitHub repo with setFernToken enabled, projectDir: ${projectDir}`);
        const result = await postGitRepository({
            orgName: Auth0OrgName(data.orgName),
            owner: demoCreationBotOwner,
            repoName,
            description: `Fern documentation for ${data.urlPrefix}.docs.buildwithfern.com`,
            isPrivate: true,
            files,
            site: `${data.urlPrefix}.docs.buildwithfern.com`,
            // Automatically generate and set FERN_TOKEN as a GitHub secret
            setFernToken: {
                workingDir: projectDir,
                fernToken: session.accessToken
            }
        });

        if (!result.success) {
            throw new Error(
                result.error.type === "ORG_ACCESS_DENIED"
                    ? result.error.message
                    : `Failed to create repository: ${result.error.type}`
            );
        }

        console.log(
            `postGitRepository result: fernToken=${result.fernToken ? "SET" : "NOT SET"}, htmlUrl=${result.htmlUrl}`
        );

        // Note: We can't connect the repo to the docs site yet because the site
        // doesn't exist in FDR until `fern generate --docs` runs in the GitHub Action.
        // The user will need to connect the repo manually in the dashboard after
        // the site is published, or we could add this to the fern CLI.

        // Add the user as a collaborator to the repo
        let collaboratorAdded = false;
        try {
            const githubUsername = await getUserGithubUsername(session.user.sub);
            if (githubUsername) {
                const octokitResult = getDemoCreationBotOctokit();
                if (octokitResult.ok) {
                    await octokitResult.octokit.request("PUT /repos/{owner}/{repo}/collaborators/{username}", {
                        owner: demoCreationBotOwner,
                        repo: repoName,
                        username: githubUsername,
                        permission: "push" // Give write access
                    });
                    collaboratorAdded = true;
                    console.log(`Added ${githubUsername} as collaborator to ${demoCreationBotOwner}/${repoName}`);
                }
            } else {
                console.log("User does not have GitHub connected, skipping collaborator addition");
            }
        } catch (collaboratorError) {
            // Don't fail the whole operation if adding collaborator fails
            console.error("Failed to add collaborator:", collaboratorError);
        }

        return NextResponse.json({
            success: true,
            githubRepoUrl: result.htmlUrl,
            repoName,
            collaboratorAdded,
            fernTokenSet: !!result.fernToken
        });
    } catch (error) {
        console.error("Error creating docs repo:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create repository" },
            { status: 500 }
        );
    } finally {
        // Cleanup temp directory
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("Failed to cleanup temp directory:", cleanupError);
            }
        }
    }
}
