import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getDemoCreationBotOctokit } from "@/app/services/auth0/fernBotOctokit";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { setFernTokenSecret } from "@/app/services/dal/github/setFernTokenSecret";
import { updateRepository } from "@/app/services/dal/github/updateRepository";
import { getGitLoader } from "@/app/services/github/getGitLoader";
import { DEFAULT_SPECS } from "@/components/onboarding/constants";
import { getDocsStarterTemplateFiles } from "@/templates/docs-starter";
import { fernCliConfig } from "@/utils/fernCliConfig";
import { parseYamlToJs, stringifyYaml, YAML_SCHEMAS } from "@/utils/yaml";
import { cleanupStaleTempDirs } from "../../cleanupStaleTempDirs";

export const maxDuration = 60;

interface CustomizeRequest {
    orgName: string;
    docsSiteUrl: string;
    docsSiteName: string;
    primaryColorHex?: string;
    // Logo can be provided as base64 data (preferred) or URL (legacy/fallback)
    logoData?: string; // base64-encoded file content
    logoFileName?: string;
    logoUrl?: string; // fallback: URL to download from
    // Favicon can be provided as base64 data (preferred) or URL (legacy/fallback)
    faviconData?: string; // base64-encoded file content
    faviconFileName?: string;
    faviconUrl?: string; // fallback: URL to download from
    openApiSpecUrls: Array<{ fileName: string; assetUrl: string }>;
}

type ApiSpecType = "openapi" | "asyncapi";

interface FetchedApiSpec {
    content: string;
    format: "json" | "yaml";
    specType: ApiSpecType;
    title: string | null;
    hasTags: boolean;
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

function getFileExtensionFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = pathname.split(".").pop()?.toLowerCase();
        return ext || "png";
    } catch {
        return "png";
    }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
}

/**
 * Parses a spec and extracts type and title
 */
function parseSpecInfo(
    content: string,
    format: "json" | "yaml"
): { specType: ApiSpecType; title: string | null; hasTags: boolean } {
    let specType: ApiSpecType = "openapi";
    let title: string | null = null;
    let hasTags = false;

    try {
        let parsed: Record<string, unknown>;

        if (format === "json") {
            parsed = JSON.parse(content);
        } else {
            parsed = parseYamlToJs<Record<string, unknown>>(content);
        }

        if (parsed.asyncapi) {
            specType = "asyncapi";
        }

        const info = parsed.info as Record<string, unknown> | undefined;
        if (info?.title && typeof info.title === "string") {
            title = info.title;
        }

        if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
            hasTags = true;
        }
    } catch {
        // Default to openapi if we can't parse
    }

    return { specType, title, hasTags };
}

async function fetchApiSpec(url: string): Promise<FetchedApiSpec> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch API spec: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    const isJson = contentType.includes("json") || url.endsWith(".json");
    const format: "json" | "yaml" = isJson ? "json" : "yaml";

    let content: string;
    if (isJson) {
        try {
            const parsed = JSON.parse(text);
            content = JSON.stringify(parsed, null, 2);
        } catch {
            content = text;
        }
    } else {
        content = text;
    }

    const { specType, title, hasTags } = parseSpecInfo(content, format);

    return { content, format, specType, title, hasTags };
}

/**
 * Converts a filename to a valid API folder name (kebab-case)
 */
function toApiName(fileName: string): string {
    const nameWithoutExt = fileName.replace(/\.(yaml|yml|json)$/i, "");
    return nameWithoutExt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

/**
 * Converts an API name to a display name
 */
function toDisplayName(apiName: string): string {
    return apiName
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Creates a generators.yml for a single API spec
 */
function createSingleApiGeneratorsYml(specFileName: string, specType: ApiSpecType): string {
    const specKey = specType === "asyncapi" ? "asyncapi" : "openapi";
    const config = {
        api: {
            specs: [{ [specKey]: specFileName }]
        }
    };

    return stringifyYaml(config, { schemaUrl: YAML_SCHEMAS.GENERATORS_YML });
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
 * Customizes the template with basic branding (no API specs).
 * This is for the first commit - gets docs live faster.
 */
async function customizeBasicTemplate(
    data: CustomizeRequest,
    projectDir: string,
    githubOwner: string,
    repoName: string
): Promise<void> {
    const fernDir = path.join(projectDir, "fern");
    const assetsDir = path.join(fernDir, "assets");

    await fs.mkdir(assetsDir, { recursive: true });

    // Update fern.config.json with org name
    const fernConfigPath = path.join(fernDir, "fern.config.json");
    const fernConfig = JSON.parse(await fs.readFile(fernConfigPath, "utf-8"));
    fernConfig.organization = data.orgName;
    await fs.writeFile(fernConfigPath, JSON.stringify(fernConfig, null, 2));

    const fullUrl = data.docsSiteUrl.includes(`.${fernCliConfig.docsDomain}`)
        ? data.docsSiteUrl
        : `${data.docsSiteUrl}.${fernCliConfig.docsDomain}`;

    // Load and update docs.yml
    const docsYmlPath = path.join(fernDir, "docs.yml");
    const docsYmlContent = await fs.readFile(docsYmlPath, "utf-8");
    const docsConfig = parseYamlToJs<Record<string, any>>(docsYmlContent);

    // Set the site URL and edit-this-page configuration
    if (!docsConfig.instances) {
        docsConfig.instances = [];
    }
    if (docsConfig.instances.length > 0) {
        docsConfig.instances[0].url = fullUrl;
    } else {
        docsConfig.instances.push({ url: fullUrl });
    }

    // Add edit-this-page configuration with GitHub launch
    docsConfig.instances[0]["edit-this-page"] = {
        github: {
            owner: githubOwner,
            repo: repoName,
            branch: "main"
        },
        launch: "dashboard"
    };

    // Set title
    docsConfig.title = `${data.docsSiteName} | Documentation`;

    // Add colors if provided
    if (data.primaryColorHex) {
        docsConfig.colors = {
            ...docsConfig.colors,
            "accent-primary": {
                dark: data.primaryColorHex,
                light: data.primaryColorHex
            }
        };
    }

    // Save logo if provided (prefer base64 data, fall back to URL)
    if (data.logoData || data.logoUrl) {
        try {
            // Remove existing logo files
            const existingAssets = await fs.readdir(assetsDir).catch(() => []);
            const logoFilesToRemove = ["logo.", "logo-dark.", "logo-light.", "fern-logo-primary.", "fern-logo-white."];

            for (const file of existingAssets) {
                if (logoFilesToRemove.some((prefix) => file.startsWith(prefix))) {
                    await fs.unlink(path.join(assetsDir, file)).catch(() => {});
                }
            }

            const ext = data.logoFileName
                ? data.logoFileName.split(".").pop()?.toLowerCase() || "png"
                : data.logoUrl
                  ? getFileExtensionFromUrl(data.logoUrl)
                  : "png";
            const logoFileName = `logo.${ext}`;
            const logoPath = path.join(assetsDir, logoFileName);

            if (data.logoData) {
                // Write base64 data directly
                await fs.writeFile(logoPath, Buffer.from(data.logoData, "base64"));
            } else if (data.logoUrl) {
                // Fallback: download from URL
                await downloadFile(data.logoUrl, logoPath);
            }

            docsConfig.logo = {
                light: `./assets/${logoFileName}`,
                dark: `./assets/${logoFileName}`,
                height: 30
            };
        } catch (error) {
            console.error("[customize] Failed to save logo:", error);
        }
    }

    // Save favicon if provided (prefer base64 data, fall back to URL)
    if (data.faviconData || data.faviconUrl) {
        try {
            const existingAssets = await fs.readdir(assetsDir).catch(() => []);
            for (const file of existingAssets) {
                if (file.startsWith("favicon.")) {
                    await fs.unlink(path.join(assetsDir, file)).catch(() => {});
                }
            }

            const ext = data.faviconFileName
                ? data.faviconFileName.split(".").pop()?.toLowerCase() || "png"
                : data.faviconUrl
                  ? getFileExtensionFromUrl(data.faviconUrl)
                  : "png";
            const faviconFileName = `favicon.${ext}`;
            const faviconPath = path.join(assetsDir, faviconFileName);

            if (data.faviconData) {
                // Write base64 data directly
                await fs.writeFile(faviconPath, Buffer.from(data.faviconData, "base64"));
            } else if (data.faviconUrl) {
                // Fallback: download from URL
                await downloadFile(data.faviconUrl, faviconPath);
            }

            docsConfig.favicon = `./assets/${faviconFileName}`;
        } catch (error) {
            console.error("[customize] Failed to save favicon:", error);
        }
    }

    // Remove generators.yml for first commit (will be added with API specs)
    await fs.unlink(path.join(fernDir, "generators.yml")).catch(() => {});

    // Write updated docs.yml
    await fs.writeFile(docsYmlPath, stringifyYaml(docsConfig, { schemaUrl: YAML_SCHEMAS.DOCS_YML }));
}

/**
 * Prepares API spec files for a second commit.
 * Creates separate apis/{api-name}/ folders for each spec.
 * Returns the files to be committed, or null if processing failed.
 */
async function prepareApiSpecFiles(
    data: CustomizeRequest,
    tempDir: string
): Promise<Array<{ path: string; content: string }> | null> {
    const files: Array<{ path: string; content: string }> = [];
    const fernDir = path.join(tempDir, "fern");

    // Track API info for navigation
    const apiInfos: Array<{ apiName: string; displayName: string; hasTags: boolean }> = [];

    // Download and prepare API spec files in separate folders
    for (const spec of data.openApiSpecUrls) {
        try {
            console.log(`[customize] Fetching API spec: ${spec.fileName} from ${spec.assetUrl.substring(0, 80)}...`);
            const { content, format, specType, title, hasTags } = await fetchApiSpec(spec.assetUrl);
            const apiName = toApiName(spec.fileName);
            const displayName = title || toDisplayName(apiName);

            const specFileName =
                specType === "asyncapi"
                    ? `asyncapi.${format === "json" ? "json" : "yml"}`
                    : `openapi.${format === "json" ? "json" : "yaml"}`;

            files.push({
                path: `fern/apis/${apiName}/${specFileName}`,
                content
            });

            const generatorsYml = createSingleApiGeneratorsYml(specFileName, specType);
            files.push({
                path: `fern/apis/${apiName}/generators.yml`,
                content: generatorsYml
            });

            apiInfos.push({ apiName, displayName, hasTags });
            console.log(
                `[customize] Successfully prepared spec: ${spec.fileName} -> apis/${apiName}/${specFileName} (${specType}, ${format})`
            );
        } catch (error) {
            console.error(
                `[customize] Failed to download API spec ${spec.fileName} from ${spec.assetUrl.substring(0, 80)}:`,
                error
            );
        }
    }

    if (apiInfos.length === 0) {
        return null;
    }

    // Update docs.yml to add API Reference tab
    const docsYmlPath = path.join(fernDir, "docs.yml");
    const docsYmlContent = await fs.readFile(docsYmlPath, "utf-8");
    const docsConfig = parseYamlToJs<Record<string, any>>(docsYmlContent);

    // Find existing API Reference tab in navigation
    if (!docsConfig.navigation) {
        docsConfig.navigation = [];
    }

    const apiRefTabIndex = docsConfig.navigation.findIndex(
        (nav: any) => nav.tab === "API Reference" || nav.tab === "api-reference"
    );

    // Build the Overview section (preserved from template)
    const overviewSection = {
        section: "Overview",
        contents: [
            {
                page: "API reference",
                path: "docs/pages/api-reference-overview.mdx",
                icon: "fa-duotone fa-book"
            }
        ]
    };

    // Build the new layout based on number of APIs
    let newLayout: any[];
    if (apiInfos.length === 1) {
        // Single API: use flattened style without api-name
        // If the spec has tags defined, don't flatten so tags show up collapsed
        const singleApi = apiInfos[0];
        newLayout = [
            overviewSection,
            {
                api: singleApi?.displayName,
                flattened: !singleApi?.hasTags
            }
        ];
    } else {
        // Multiple APIs: use section with api-name for each
        const apiContents = apiInfos.map(({ apiName, displayName }) => ({
            api: displayName,
            "api-name": apiName
        }));
        newLayout = [
            overviewSection,
            {
                section: "Endpoints",
                contents: apiContents
            }
        ];
    }

    if (apiRefTabIndex !== -1) {
        // Update existing tab
        docsConfig.navigation[apiRefTabIndex].layout = newLayout;
    } else {
        // Fallback: add new tab if not found
        docsConfig.navigation.push({
            tab: "API Reference",
            layout: newLayout
        });
    }

    files.push({
        path: "fern/docs.yml",
        content: stringifyYaml(docsConfig, { schemaUrl: YAML_SCHEMAS.DOCS_YML })
    });

    return files;
}

/**
 * Creates a repo if it doesn't exist (fallback for resilience).
 * Creates only with auto_init (no template files) to minimize commits.
 */
async function ensureRepoExists(
    owner: string,
    repoName: string,
    orgName: string,
    accessToken: string
): Promise<{ created: boolean; htmlUrl: string }> {
    const exists = await repoExists(owner, repoName);
    if (exists) {
        return { created: false, htmlUrl: `https://github.com/${owner}/${repoName}` };
    }

    console.log(`[customize] Repo ${owner}/${repoName} doesn't exist, creating it...`);

    // Create the repo without template files (only auto_init commit).
    // All content will be added in the single customize commit below.
    const repoUrl = `https://github.com/${owner}/${repoName}`;
    const loader = await getGitLoader(repoUrl, true);

    const result = await loader.createRepository?.({
        owner,
        repoName,
        description: `Documentation for ${orgName}`,
        isPrivate: true,
        files: []
    });

    if (!result || result.type !== "ok") {
        const errorMsg = result?.type === "error" ? result.error.message : "createRepository not available";
        throw new Error(`Failed to create repository: ${errorMsg}`);
    }

    // Set FERN_TOKEN
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-token-"));
    try {
        const fernDir = path.join(tempDir, "fern");
        await fs.mkdir(fernDir, { recursive: true });

        await fs.writeFile(
            path.join(fernDir, "fern.config.json"),
            JSON.stringify({ organization: orgName, version: "*" }, null, 2)
        );

        const docsUrl = `${repoName}.${fernCliConfig.docsDomain}`;
        await fs.writeFile(path.join(fernDir, "docs.yml"), `instances:\n  - url: ${docsUrl}\n\ntitle: Documentation\n`);

        await setFernTokenSecret({
            owner,
            repoName,
            workingDir: tempDir,
            fernToken: accessToken
        });
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }

    return { created: true, htmlUrl: result.htmlUrl };
}

/**
 * POST /api/onboarding-docs/customize/[repo]
 *
 * Applies all customizations to an existing repository in a single commit:
 * - Basic branding (URL, title, colors, logo, favicon)
 * - API specs and navigation
 *
 * This minimizes the number of commits that trigger the publish-docs workflow,
 * avoiding race conditions from concurrent publishes.
 *
 * If the repo doesn't exist, it will be auto-created for resilience.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ repo: string }> }) {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { repo: repoName } = await params;
    if (!repoName) {
        return NextResponse.json({ error: "Repository name is required" }, { status: 400 });
    }

    let data: CustomizeRequest;
    try {
        data = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!data.orgName || !data.docsSiteUrl || !data.docsSiteName) {
        return NextResponse.json({ error: "orgName, docsSiteUrl, and docsSiteName are required" }, { status: 400 });
    }

    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;
    if (!demoCreationBotOwner) {
        console.error("[customize] FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let tempDir: string | null = null;

    try {
        // Clean up any stale temp directories from previous invocations
        // to prevent ENOSPC errors in serverless environments
        await cleanupStaleTempDirs();

        // Ensure repo exists (auto-create if not)
        const { htmlUrl: githubRepoUrl } = await ensureRepoExists(
            demoCreationBotOwner,
            repoName,
            data.orgName,
            session.accessToken
        );

        // Create temp directory and copy template files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-customize-"));

        // Get template files and write to temp directory
        const templateFiles = await getDocsStarterTemplateFiles();
        for (const file of templateFiles) {
            const filePath = path.join(tempDir, file.path);
            await fs.mkdir(path.dirname(filePath), { recursive: true });

            if (file.encoding === "base64") {
                await fs.writeFile(filePath, Buffer.from(file.content, "base64"));
            } else {
                await fs.writeFile(filePath, file.content);
            }
        }

        // Apply basic customizations (branding)
        await customizeBasicTemplate(data, tempDir, demoCreationBotOwner, repoName);

        // Prepare API spec files before committing so everything goes in one commit
        const specsToUse = data.openApiSpecUrls.length > 0 ? data.openApiSpecUrls : [...DEFAULT_SPECS];
        console.log(
            `[customize] API specs for ${repoName}: received ${data.openApiSpecUrls.length} specs, using ${specsToUse.length} specs`,
            specsToUse.map((s) => ({ fileName: s.fileName, urlPrefix: s.assetUrl.substring(0, 60) }))
        );
        const apiSpecFiles = await prepareApiSpecFiles({ ...data, openApiSpecUrls: specsToUse }, tempDir);

        if (!apiSpecFiles) {
            console.warn(
                `[customize] prepareApiSpecFiles returned null for ${repoName} - all spec downloads may have failed`
            );
        }

        // Read all branding files from temp directory
        const brandingFiles = await readAllFilesFromDirectory(tempDir);

        // Merge branding files with API spec files into a single file list.
        // API spec files take precedence (they include an updated docs.yml with API reference nav).
        const allFiles = [...brandingFiles];
        if (apiSpecFiles) {
            const apiSpecPaths = new Set(apiSpecFiles.map((f) => f.path));
            // Remove branding files that are overridden by API spec files (e.g. docs.yml)
            const filteredBrandingFiles = allFiles.filter((f) => !apiSpecPaths.has(f.path));
            filteredBrandingFiles.push(...apiSpecFiles);
            allFiles.length = 0;
            allFiles.push(...filteredBrandingFiles);
        }

        // Single commit with all customizations: branding + API specs
        const updateResult = await updateRepository({
            owner: demoCreationBotOwner,
            repoName,
            files: allFiles,
            message: "Customize documentation"
        });

        if (!updateResult.success) {
            throw new Error(`Failed to update repository: ${updateResult.error}`);
        }

        const docsCommitSha = updateResult.commitSha;
        console.log(`[customize] All customizations committed for ${repoName} (sha: ${docsCommitSha})`);

        const normalizedDocsUrl = data.docsSiteUrl.includes(`.${fernCliConfig.docsDomain}`)
            ? data.docsSiteUrl
            : `${data.docsSiteUrl}.${fernCliConfig.docsDomain}`;

        return NextResponse.json({
            success: true,
            commitSha: docsCommitSha,
            docsUrl: `https://${normalizedDocsUrl}`,
            githubRepoUrl
        });
    } catch (error) {
        console.error("[customize] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to customize documentation" },
            { status: 500 }
        );
    } finally {
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("[customize] Failed to cleanup temp directory:", cleanupError);
            }
        }
    }
}
