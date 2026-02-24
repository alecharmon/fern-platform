import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { NextRequest } from "next/server";
import { extract } from "tar";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getUserGithubUsername } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import postGitRepository from "@/app/services/dal/github/postGitRepository";
import { fernCliConfig } from "@/utils/fernCliConfig";
import { parseYamlToJs, stringifyYaml, YAML_SCHEMAS } from "@/utils/yaml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes

interface ProgressEvent {
    type: "progress" | "complete" | "error";
    step?: number;
    totalSteps?: number;
    message: string;
    data?: Record<string, unknown>;
}

interface CreateDocsRepoRequest {
    orgName: string;
    urlPrefix: string;
    sourceType?: "template" | "site-to-docs";
    templateId?: "classic" | "minimal" | "products" | "no-top-bar";
    companyName?: string;
    primaryColorHex?: string;
    fonts?: {
        headings?: string;
        body?: string;
        code?: string;
    };
    logoBase64?: string;
    faviconBase64?: string;
    siteToDocsFiles?: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>;
    sourceUrl?: string;
    postmanCollectionId?: string;
    postmanTeamId?: string;
}

// Helper functions imported from main route
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
    return binaryExtensions.has(path.extname(filePath).toLowerCase());
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

function getExtensionFromBase64(base64: string): string {
    const match = base64.match(/^data:image\/([^;]+);base64,/);
    if (match?.[1]) {
        const mimeToExt: Record<string, string> = {
            png: "png",
            jpeg: "jpg",
            jpg: "jpg",
            gif: "gif",
            "svg+xml": "svg",
            "x-icon": "ico",
            "vnd.microsoft.icon": "ico"
        };
        return mimeToExt[match[1]] || "png";
    }
    return "png";
}

function base64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
}

async function downloadGoogleFont(fontName: string, weight: number = 400): Promise<Buffer | null> {
    try {
        const cssUrl = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@${weight}&display=swap`;
        const cssResponse = await fetch(cssUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });
        if (!cssResponse.ok) {
            return null;
        }
        const css = await cssResponse.text();
        const latinBlockMatch = css.match(
            /\/\*\s*latin\s*\*\/\s*@font-face\s*\{[^}]*src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)[^}]*unicode-range:\s*U\+0000-00FF/
        );
        const fontUrl = latinBlockMatch?.[1] || css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1];
        if (!fontUrl) {
            return null;
        }
        const fontResponse = await fetch(fontUrl);
        if (!fontResponse.ok) {
            return null;
        }
        return Buffer.from(await fontResponse.arrayBuffer());
    } catch {
        return null;
    }
}

async function replaceWelcomeTextInMarkdownFiles(dirPath: string, companyName: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await replaceWelcomeTextInMarkdownFiles(fullPath, companyName);
        } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
            const content = await fs.readFile(fullPath, "utf-8");
            const updated = content.replace(/Welcome to Fern/gi, `Welcome to ${companyName}`);
            if (content !== updated) {
                await fs.writeFile(fullPath, updated);
            }
        }
    }
}

export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    let data: CreateDocsRepoRequest;
    try {
        data = await req.json();
    } catch {
        return new Response("Invalid request body", { status: 400 });
    }

    const sourceType = data.sourceType ?? "template";
    if (!data.orgName || !data.urlPrefix) {
        return new Response("orgName and urlPrefix are required", { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: ProgressEvent) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            };

            let tempDir: string | null = null;
            const totalSteps = 5;

            try {
                // Step 1: Prepare files
                sendEvent({ type: "progress", step: 1, totalSteps, message: "Preparing files..." });

                tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-docs-repo-"));
                const projectDir = path.join(tempDir, "project");
                await fs.mkdir(projectDir, { recursive: true });

                let files: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>;

                if (sourceType === "site-to-docs" && data.siteToDocsFiles) {
                    // Write site-to-docs files
                    for (const file of data.siteToDocsFiles) {
                        const filePath = path.join(projectDir, file.path);
                        await fs.mkdir(path.dirname(filePath), { recursive: true });
                        if (file.encoding === "base64") {
                            await fs.writeFile(filePath, Buffer.from(file.content, "base64"));
                        } else {
                            await fs.writeFile(filePath, file.content, "utf-8");
                        }
                    }

                    // Update fern.config.json
                    const fernConfigPath = path.join(projectDir, "fern", "fern.config.json");
                    try {
                        const config = JSON.parse(await fs.readFile(fernConfigPath, "utf-8"));
                        config.organization = data.orgName;
                        await fs.writeFile(fernConfigPath, JSON.stringify(config, null, 2));
                    } catch {
                        /* ignore */
                    }

                    // Update docs.yml
                    const docsYmlPath = path.join(projectDir, "fern", "docs.yml");
                    try {
                        const docsConfig = parseYamlToJs<Record<string, unknown>>(
                            await fs.readFile(docsYmlPath, "utf-8")
                        ) as Record<string, unknown> & { instances?: Array<Record<string, unknown>> };
                        if (!docsConfig.instances) {
                            docsConfig.instances = [];
                        }
                        if (docsConfig.instances.length > 0) {
                            docsConfig.instances[0]!.url = `${data.urlPrefix}.${fernCliConfig.docsDomain}`;
                        } else {
                            docsConfig.instances.push({ url: `${data.urlPrefix}.${fernCliConfig.docsDomain}` });
                        }
                        await fs.writeFile(
                            docsYmlPath,
                            stringifyYaml(docsConfig, { schemaUrl: YAML_SCHEMAS.DOCS_YML })
                        );
                    } catch {
                        /* ignore */
                    }
                } else {
                    // Download template
                    const tarballUrl = "https://github.com/fern-api/docs-templates/archive/refs/heads/main.tar.gz";
                    const response = await fetch(tarballUrl);
                    if (!response.ok) {
                        throw new Error("Failed to download templates");
                    }

                    const tarballPath = path.join(tempDir, "templates.tar.gz");
                    await fs.writeFile(tarballPath, Buffer.from(await response.arrayBuffer()));

                    const extractDir = path.join(tempDir, "extracted");
                    await fs.mkdir(extractDir, { recursive: true });
                    await extract({ file: tarballPath, cwd: extractDir });
                    await fs.unlink(tarballPath);

                    const extractedContents = await fs.readdir(extractDir);
                    const repoFolder = extractedContents.find((f) => f.startsWith("docs-templates"));
                    if (!repoFolder) {
                        throw new Error("Could not find template folder");
                    }

                    const templateSrc = path.join(extractDir, repoFolder, data.templateId || "classic");
                    await fs.cp(templateSrc, projectDir, { recursive: true });
                }

                // Step 2: Customize template
                sendEvent({ type: "progress", step: 2, totalSteps, message: "Customizing template..." });

                const fernDir = path.join(projectDir, "fern");
                const assetsDir = path.join(fernDir, "assets");
                await fs.mkdir(assetsDir, { recursive: true });

                // Update fern.config.json
                const fernConfigPath = path.join(fernDir, "fern.config.json");
                try {
                    const config = JSON.parse(await fs.readFile(fernConfigPath, "utf-8"));
                    config.organization = data.orgName;
                    await fs.writeFile(fernConfigPath, JSON.stringify(config, null, 2));
                } catch {
                    /* ignore */
                }

                // Update docs.yml
                const docsYmlPath = path.join(fernDir, "docs.yml");
                try {
                    const docsConfig = parseYamlToJs<Record<string, any>>(await fs.readFile(docsYmlPath, "utf-8"));
                    if (!docsConfig.instances) {
                        docsConfig.instances = [];
                    }
                    if (docsConfig.instances.length > 0) {
                        docsConfig.instances[0].url = `${data.urlPrefix}.${fernCliConfig.docsDomain}`;
                    } else {
                        docsConfig.instances.push({ url: `${data.urlPrefix}.${fernCliConfig.docsDomain}` });
                    }

                    if (data.companyName) {
                        docsConfig.title = `${data.companyName} | Documentation`;
                    }
                    if (data.primaryColorHex) {
                        docsConfig.colors = {
                            ...docsConfig.colors,
                            "accent-primary": { dark: data.primaryColorHex, light: data.primaryColorHex }
                        };
                    }

                    // Download fonts
                    if (data.fonts) {
                        const fontsDir = path.join(fernDir, "docs", "assets", "fonts");
                        await fs.mkdir(fontsDir, { recursive: true });
                        const typography: Record<string, { name: string; path: string }> = {};

                        if (data.fonts.headings && data.fonts.headings !== "default") {
                            const buffer = await downloadGoogleFont(data.fonts.headings, 600);
                            if (buffer) {
                                const fileName = `${data.fonts.headings.replace(/ /g, "-")}-SemiBold.woff2`;
                                await fs.writeFile(path.join(fontsDir, fileName), buffer);
                                typography.headingsFont = {
                                    name: data.fonts.headings,
                                    path: `./docs/assets/fonts/${fileName}`
                                };
                            }
                        }
                        if (data.fonts.body && data.fonts.body !== "default") {
                            const buffer = await downloadGoogleFont(data.fonts.body, 400);
                            if (buffer) {
                                const fileName = `${data.fonts.body.replace(/ /g, "-")}-Regular.woff2`;
                                await fs.writeFile(path.join(fontsDir, fileName), buffer);
                                typography.bodyFont = {
                                    name: data.fonts.body,
                                    path: `./docs/assets/fonts/${fileName}`
                                };
                            }
                        }
                        if (data.fonts.code && data.fonts.code !== "default") {
                            const buffer = await downloadGoogleFont(data.fonts.code, 400);
                            if (buffer) {
                                const fileName = `${data.fonts.code.replace(/ /g, "-")}-Regular.woff2`;
                                await fs.writeFile(path.join(fontsDir, fileName), buffer);
                                typography.codeFont = {
                                    name: data.fonts.code,
                                    path: `./docs/assets/fonts/${fileName}`
                                };
                            }
                        }
                        if (Object.keys(typography).length > 0) {
                            docsConfig.typography = typography;
                        }
                    }

                    // Save logo
                    if (data.logoBase64) {
                        const ext = getExtensionFromBase64(data.logoBase64);
                        const fileName = `logo.${ext}`;
                        await fs.writeFile(path.join(assetsDir, fileName), base64ToBuffer(data.logoBase64));
                        docsConfig.logo = { light: `./assets/${fileName}`, dark: `./assets/${fileName}`, height: 30 };
                    }

                    // Save favicon
                    if (data.faviconBase64) {
                        const ext = getExtensionFromBase64(data.faviconBase64);
                        const fileName = `favicon.${ext}`;
                        await fs.writeFile(path.join(assetsDir, fileName), base64ToBuffer(data.faviconBase64));
                        docsConfig.favicon = `./assets/${fileName}`;
                    }

                    await fs.writeFile(docsYmlPath, stringifyYaml(docsConfig, { schemaUrl: YAML_SCHEMAS.DOCS_YML }));
                } catch {
                    /* ignore */
                }

                // Replace company name in markdown
                if (data.companyName) {
                    try {
                        await replaceWelcomeTextInMarkdownFiles(path.join(fernDir, "docs"), data.companyName);
                    } catch {
                        /* ignore */
                    }
                }

                // Create GitHub Actions workflow
                const workflowDir = path.join(projectDir, ".github", "workflows");
                await fs.mkdir(workflowDir, { recursive: true });
                await fs.writeFile(
                    path.join(workflowDir, "publish-docs.yml"),
                    `name: Publish Docs

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
        run: npm install -g ${fernCliConfig.npmPackage}

      - name: Publish Docs
        env:
          FERN_TOKEN: \${{ secrets.FERN_TOKEN }}
        run: ${fernCliConfig.cliCommand} generate --docs
`
                );

                files = await readAllFilesFromDirectory(projectDir);

                // Step 3: Generate Fern token
                sendEvent({ type: "progress", step: 3, totalSteps, message: "Generating Fern token..." });

                const repoName = `${data.urlPrefix}-docs`.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
                const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
                if (!demoCreationBotOwner) {
                    console.error("[create-docs-repo] FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
                    throw new Error("Server configuration error");
                }

                // Step 4: Create GitHub repository
                sendEvent({ type: "progress", step: 4, totalSteps, message: "Creating GitHub repository..." });

                const description =
                    sourceType === "site-to-docs" && data.sourceUrl
                        ? `Fern documentation imported from ${data.sourceUrl}`
                        : `Fern documentation for ${data.urlPrefix}.${fernCliConfig.docsDomain}`;

                const result = await postGitRepository({
                    orgName: Auth0OrgName(data.orgName),
                    owner: demoCreationBotOwner,
                    repoName,
                    description,
                    isPrivate: true,
                    files,
                    site: `${data.urlPrefix}.${fernCliConfig.docsDomain}`,
                    setFernToken: { workingDir: projectDir, fernToken: session.accessToken }
                });

                if (!result.success) {
                    throw new Error(
                        result.error.type === "ORG_ACCESS_DENIED"
                            ? result.error.message
                            : `Failed to create repository: ${result.error.type}`
                    );
                }

                // Step 5: Add collaborator
                sendEvent({ type: "progress", step: 5, totalSteps, message: "Adding collaborator..." });

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
                                permission: "push"
                            });
                            collaboratorAdded = true;
                        }
                    }
                } catch {
                    /* ignore */
                }

                // Complete
                sendEvent({
                    type: "complete",
                    message: "Repository created successfully!",
                    data: {
                        success: true,
                        githubRepoUrl: result.htmlUrl,
                        repoName,
                        collaboratorAdded,
                        fernTokenSet: !!result.fernToken,
                        postmanCollectionId: data.postmanCollectionId,
                        postmanTeamId: data.postmanTeamId
                    }
                });
            } catch (error) {
                sendEvent({
                    type: "error",
                    message: error instanceof Error ? error.message : "Failed to create repository"
                });
            } finally {
                if (tempDir) {
                    try {
                        await fs.rm(tempDir, { recursive: true, force: true });
                    } catch {
                        /* ignore */
                    }
                }
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive"
        }
    });
}
