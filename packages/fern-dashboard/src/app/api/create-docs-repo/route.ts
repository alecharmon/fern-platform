import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { extract } from "tar";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getUserGithubUsername } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";
import postGitRepository from "@/app/services/dal/github/postGitRepository";
import { parseYamlToJs, stringifyYaml, YAML_SCHEMAS } from "@/utils/yaml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateDocsRepoRequest {
    orgName: string;
    urlPrefix: string; // The subdomain prefix (e.g., "my-company" for my-company.docs.buildwithfern.com)
    sourceType?: "template" | "site-to-docs"; // Type of source, defaults to "template"

    // Template flow fields
    templateId?: "classic" | "minimal" | "products" | "no-top-bar";
    companyName?: string; // Replaces "Fern" throughout the docs
    primaryColorHex?: string;
    fonts?: {
        headings?: string;
        body?: string;
        code?: string;
    };
    logoBase64?: string; // Base64 data URL for logo image
    faviconBase64?: string; // Base64 data URL for favicon image

    // Site-to-docs flow fields
    siteToDocsFiles?: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>;
    sourceUrl?: string; // Original URL that was converted
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

/**
 * Extracts the file extension from a base64 data URL
 */
function getExtensionFromBase64(base64: string): string {
    const match = base64.match(/^data:image\/([^;]+);base64,/);
    if (match?.[1]) {
        const mimeType = match[1];
        // Map common MIME types to extensions
        const mimeToExt: Record<string, string> = {
            png: "png",
            jpeg: "jpg",
            jpg: "jpg",
            gif: "gif",
            "svg+xml": "svg",
            "x-icon": "ico",
            "vnd.microsoft.icon": "ico"
        };
        return mimeToExt[mimeType] || "png";
    }
    return "png";
}

/**
 * Converts a base64 data URL to a Buffer
 */
function base64ToBuffer(base64: string): Buffer {
    const base64Data = base64.replace(/^data:image\/[^;]+;base64,/, "");
    return Buffer.from(base64Data, "base64");
}

/**
 * Downloads a Google Font and returns the woff2 buffer for the latin subset.
 * Google Fonts returns multiple subsets (cyrillic, greek, latin, etc.) - we specifically
 * extract the "latin" subset which covers standard ASCII characters (U+0000-00FF).
 */
async function downloadGoogleFont(fontName: string, weight: number = 400): Promise<Buffer | null> {
    try {
        // Request CSS from Google Fonts with a modern user-agent to get woff2
        const cssUrl = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@${weight}&display=swap`;
        const cssResponse = await fetch(cssUrl, {
            headers: {
                // Modern user-agent to get woff2 format
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!cssResponse.ok) {
            console.error(`Failed to fetch font CSS for ${fontName}: ${cssResponse.statusText}`);
            return null;
        }

        const css = await cssResponse.text();

        // Extract the woff2 URL specifically from the "latin" subset block.
        // Google Fonts CSS has comments like "/* latin */" before each @font-face block.
        // The latin subset covers U+0000-00FF which includes standard ASCII characters.
        const latinBlockMatch = css.match(
            /\/\*\s*latin\s*\*\/\s*@font-face\s*\{[^}]*src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)[^}]*unicode-range:\s*U\+0000-00FF/
        );

        if (!latinBlockMatch) {
            // Fallback: try to find any woff2 URL if latin block not found
            console.warn(`Could not find latin subset for ${fontName}, trying fallback`);
            const fallbackMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
            if (!fallbackMatch) {
                console.error(`Could not find any woff2 URL in CSS for ${fontName}`);
                return null;
            }
            const fontResponse = await fetch(fallbackMatch[1]!);
            if (!fontResponse.ok) {
                console.error(`Failed to download font file for ${fontName}: ${fontResponse.statusText}`);
                return null;
            }
            return Buffer.from(await fontResponse.arrayBuffer());
        }

        // Download the woff2 file for the latin subset
        const fontResponse = await fetch(latinBlockMatch[1]!);
        if (!fontResponse.ok) {
            console.error(`Failed to download font file for ${fontName}: ${fontResponse.statusText}`);
            return null;
        }

        return Buffer.from(await fontResponse.arrayBuffer());
    } catch (err) {
        console.error(`Error downloading font ${fontName}:`, err);
        return null;
    }
}

/**
 * Recursively replaces "Welcome to Fern" in all markdown files in a directory
 */
async function replaceWelcomeTextInMarkdownFiles(dirPath: string, companyName: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            await replaceWelcomeTextInMarkdownFiles(fullPath, companyName);
        } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
            const content = await fs.readFile(fullPath, "utf-8");
            const updatedContent = content.replace(/Welcome to Fern/gi, `Welcome to ${companyName}`);
            if (content !== updatedContent) {
                await fs.writeFile(fullPath, updatedContent);
            }
        }
    }
}

async function customizeTemplate(data: CreateDocsRepoRequest, projectDir: string): Promise<void> {
    const fernDir = path.join(projectDir, "fern");
    const assetsDir = path.join(fernDir, "assets");

    // Create assets directory if it doesn't exist
    await fs.mkdir(assetsDir, { recursive: true });

    // Update fern.config.json with org name
    const fernConfigPath = path.join(fernDir, "fern.config.json");
    const fernConfig = JSON.parse(await fs.readFile(fernConfigPath, "utf-8"));
    fernConfig.organization = data.orgName;
    await fs.writeFile(fernConfigPath, JSON.stringify(fernConfig, null, 2));

    // Load and update docs.yml
    const docsYmlPath = path.join(fernDir, "docs.yml");
    const docsYmlContent = await fs.readFile(docsYmlPath, "utf-8");
    const docsConfig = parseYamlToJs<Record<string, unknown>>(docsYmlContent);

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

    // Set title if company name is provided
    if (data.companyName) {
        docsConfigAny.title = `${data.companyName} | Documentation`;
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

    // Add typography/fonts if provided - download fonts and save to assets
    if (data.fonts) {
        const fontsDir = path.join(fernDir, "docs", "assets", "fonts");
        await fs.mkdir(fontsDir, { recursive: true });

        const typography: Record<string, { name: string; path: string }> = {};

        // Download and save headings font
        if (data.fonts.headings && data.fonts.headings !== "default") {
            const fontBuffer = await downloadGoogleFont(data.fonts.headings, 600);
            if (fontBuffer) {
                const fileName = `${data.fonts.headings.replace(/ /g, "-")}-SemiBold.woff2`;
                await fs.writeFile(path.join(fontsDir, fileName), fontBuffer);
                typography.headingsFont = {
                    name: data.fonts.headings,
                    path: `./docs/assets/fonts/${fileName}`
                };
            }
        }

        // Download and save body font
        if (data.fonts.body && data.fonts.body !== "default") {
            const fontBuffer = await downloadGoogleFont(data.fonts.body, 400);
            if (fontBuffer) {
                const fileName = `${data.fonts.body.replace(/ /g, "-")}-Regular.woff2`;
                await fs.writeFile(path.join(fontsDir, fileName), fontBuffer);
                typography.bodyFont = {
                    name: data.fonts.body,
                    path: `./docs/assets/fonts/${fileName}`
                };
            }
        }

        // Download and save code font
        if (data.fonts.code && data.fonts.code !== "default") {
            const fontBuffer = await downloadGoogleFont(data.fonts.code, 400);
            if (fontBuffer) {
                const fileName = `${data.fonts.code.replace(/ /g, "-")}-Regular.woff2`;
                await fs.writeFile(path.join(fontsDir, fileName), fontBuffer);
                typography.codeFont = {
                    name: data.fonts.code,
                    path: `./docs/assets/fonts/${fileName}`
                };
            }
        }

        if (Object.keys(typography).length > 0) {
            docsConfigAny.typography = typography;
        }
    }

    // Save logo file and update docs.yml if provided
    if (data.logoBase64) {
        const logoExt = getExtensionFromBase64(data.logoBase64);
        const logoFileName = `logo.${logoExt}`;
        const logoPath = path.join(assetsDir, logoFileName);
        await fs.writeFile(logoPath, base64ToBuffer(data.logoBase64));

        // Set logo in docs.yml (use same file for light and dark)
        docsConfigAny.logo = {
            light: `./assets/${logoFileName}`,
            dark: `./assets/${logoFileName}`,
            height: 30
        };
    }

    // Save favicon file and update docs.yml if provided
    if (data.faviconBase64) {
        const faviconExt = getExtensionFromBase64(data.faviconBase64);
        const faviconFileName = `favicon.${faviconExt}`;
        const faviconPath = path.join(assetsDir, faviconFileName);
        await fs.writeFile(faviconPath, base64ToBuffer(data.faviconBase64));

        // Set favicon in docs.yml
        docsConfigAny.favicon = `./assets/${faviconFileName}`;
    }

    // Write updated docs.yml
    await fs.writeFile(docsYmlPath, stringifyYaml(docsConfig, { schemaUrl: YAML_SCHEMAS.DOCS_YML }));

    // Replace "Welcome to Fern" with company name in markdown files
    if (data.companyName) {
        const docsDir = path.join(fernDir, "docs");
        try {
            await replaceWelcomeTextInMarkdownFiles(docsDir, data.companyName);
        } catch (_err) {
            // Docs directory might not exist in all templates
            console.log("No docs directory found, skipping text replacement");
        }
    }

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

/**
 * Writes site-to-docs files to the project directory and updates configuration
 */
async function writeSiteToDocsFiles(
    files: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>,
    projectDir: string,
    orgName: string,
    urlPrefix: string
): Promise<void> {
    // Write all files from site-to-docs output
    for (const file of files) {
        const filePath = path.join(projectDir, file.path);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        if (file.encoding === "base64") {
            const buffer = Buffer.from(file.content, "base64");
            await fs.writeFile(filePath, buffer);
        } else {
            await fs.writeFile(filePath, file.content, "utf-8");
        }
    }

    // Update fern.config.json with actual organization
    const fernConfigPath = path.join(projectDir, "fern", "fern.config.json");
    try {
        const fernConfigContent = await fs.readFile(fernConfigPath, "utf-8");
        const fernConfig = JSON.parse(fernConfigContent);
        fernConfig.organization = orgName;
        await fs.writeFile(fernConfigPath, JSON.stringify(fernConfig, null, 2));
    } catch (err) {
        console.warn("Could not update fern.config.json:", err);
    }

    // Update docs.yml with actual site URL
    const docsYmlPath = path.join(projectDir, "fern", "docs.yml");
    try {
        const docsYmlContent = await fs.readFile(docsYmlPath, "utf-8");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const docsConfig = parseYamlToJs<Record<string, any>>(docsYmlContent);

        // Update or add the instances with the correct URL
        if (!docsConfig.instances) {
            docsConfig.instances = [];
        }
        if (docsConfig.instances.length > 0) {
            docsConfig.instances[0].url = `${urlPrefix}.docs.buildwithfern.com`;
        } else {
            docsConfig.instances.push({ url: `${urlPrefix}.docs.buildwithfern.com` });
        }

        await fs.writeFile(docsYmlPath, stringifyYaml(docsConfig, { schemaUrl: YAML_SCHEMAS.DOCS_YML }));
    } catch (err) {
        console.warn("Could not update docs.yml:", err);
    }

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

    // Determine source type (default to template for backwards compatibility)
    const sourceType = data.sourceType ?? "template";

    // Validate required fields
    if (!data.orgName || !data.urlPrefix) {
        return NextResponse.json({ error: "orgName and urlPrefix are required" }, { status: 400 });
    }

    // Validate urlPrefix format (subdomain rules)
    const urlPrefixRegex = /^[a-z0-9][a-z0-9-_]{0,61}[a-z0-9]$|^[a-z0-9]$/;
    if (!urlPrefixRegex.test(data.urlPrefix)) {
        return NextResponse.json({ error: "Invalid URL prefix format" }, { status: 400 });
    }

    // Validate based on source type
    if (sourceType === "template") {
        if (!data.templateId) {
            return NextResponse.json({ error: "templateId is required for template source" }, { status: 400 });
        }
        const validTemplates = ["classic", "minimal", "products", "no-top-bar"];
        if (!validTemplates.includes(data.templateId)) {
            return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
        }
    } else if (sourceType === "site-to-docs") {
        if (!data.siteToDocsFiles || data.siteToDocsFiles.length === 0) {
            return NextResponse.json(
                { error: "siteToDocsFiles are required for site-to-docs source" },
                { status: 400 }
            );
        }
    } else {
        return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
    }

    let tempDir: string | null = null;

    try {
        // Create temp directory
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-docs-repo-"));
        const projectDir = path.join(tempDir, "project");
        await fs.mkdir(projectDir, { recursive: true });

        let files: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>;

        if (sourceType === "site-to-docs") {
            // Site-to-docs flow: write files from siteToDocsFiles and update configuration
            await writeSiteToDocsFiles(data.siteToDocsFiles!, projectDir, data.orgName, data.urlPrefix);
            files = await readAllFilesFromDirectory(projectDir);
        } else {
            // Template flow: download and customize template
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
            const templateSrc = path.join(extractDir, repoFolder, data.templateId!);

            try {
                await fs.access(templateSrc);
            } catch {
                throw new Error(`Template '${data.templateId}' not found in repository`);
            }

            await fs.cp(templateSrc, projectDir, { recursive: true });

            // Customize the template (update org name, colors, fonts)
            await customizeTemplate(data as CreateDocsRepoRequest & { templateId: string }, projectDir);

            // Read all files from the project directory
            files = await readAllFilesFromDirectory(projectDir);
        }

        // Generate repo name from URL prefix (e.g., "my-company" becomes "my-company-docs")
        const repoName = `${data.urlPrefix}-docs`.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;

        if (!demoCreationBotOwner) {
            throw new Error("FERN_DEMO_CREATION_BOT_OWNER environment variable not set");
        }

        // Create GitHub repository and automatically set FERN_TOKEN secret
        const description =
            sourceType === "site-to-docs" && data.sourceUrl
                ? `Fern documentation imported from ${data.sourceUrl}`
                : `Fern documentation for ${data.urlPrefix}.docs.buildwithfern.com`;

        console.log(`Creating GitHub repo with setFernToken enabled, projectDir: ${projectDir}`);
        const result = await postGitRepository({
            orgName: Auth0OrgName(data.orgName),
            owner: demoCreationBotOwner,
            repoName,
            description,
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
