import "server-only";

import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import * as yaml from "js-yaml";
import { NextResponse } from "next/server";

import postGitRepository, { type RepositoryFile } from "@/app/services/dal/github/postGitRepository";
import { OnboardS3Service } from "@/app/services/onboarding-assets";

import type { MaybeErrorResponse } from "../utils/MaybeErrorResponse";

const execAsync = promisify(exec);

function getFileExtensionFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = pathname.split(".").pop()?.toLowerCase();
        return ext || "png";
    } catch {
        // Fallback if URL parsing fails
        return "png";
    }
}

export interface OnboardingDocsRequest {
    docsSiteName: string;
    orgName: string;
    docsSiteUrl: string;
    docsSiteUrlAvailable: boolean | null;
    faviconUrl: string | null;
    logoUrl: string | null;
    primaryColorHex: string | null;
    existingDocsSite: string;
    openApiSpecUrls: { fileName: string; assetUrl: string }[];
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download file from ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
}

async function fetchOpenApiSpec(url: string): Promise<{ content: string; format: "json" | "yaml" }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    const isJson = contentType.includes("json") || url.endsWith(".json");

    if (isJson) {
        try {
            const parsed = JSON.parse(text);
            return {
                content: JSON.stringify(parsed, null, 2),
                format: "json"
            };
        } catch {
            return { content: text, format: "yaml" };
        }
    }

    return { content: text, format: "yaml" };
}

function createGeneratorsYml(openApiSpecs: OnboardingDocsRequest["openApiSpecUrls"]): string | null {
    if (openApiSpecs.length === 0) {
        return null;
    }

    const config = {
        api: {
            specs: openApiSpecs.map((spec) => ({
                openapi: spec.fileName
            }))
        }
    };

    return `# yaml-language-server: $schema=https://schema.buildwithfern.dev/generators-yml.json\n\n${yaml.dump(config)}`;
}

async function copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

async function replaceInFile(filePath: string, replacements: Record<string, string>): Promise<void> {
    let content = await fs.readFile(filePath, "utf-8");
    for (const [placeholder, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(placeholder, "g"), value);
    }
    await fs.writeFile(filePath, content);
}

async function readAllFilesFromDirectory(dirPath: string, basePath: string = dirPath): Promise<RepositoryFile[]> {
    const files: RepositoryFile[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
            const subFiles = await readAllFilesFromDirectory(fullPath, basePath);
            files.push(...subFiles);
        } else {
            const content = await fs.readFile(fullPath, "utf-8");
            files.push({
                path: relativePath,
                content
            });
        }
    }

    return files;
}

async function createFernProject(data: OnboardingDocsRequest, tempDir: string): Promise<void> {
    // Copy template directory to temp location
    const templateDir = path.join(process.cwd(), "src/app/api/onboarding-docs/templates");
    const fernDir = path.join(tempDir, "fern");

    await copyDirectory(templateDir, fernDir);

    // Ensure URL has .docs.buildwithfern.com suffix
    const fullUrl = data.docsSiteUrl.includes(".docs.buildwithfern.com")
        ? data.docsSiteUrl
        : `${data.docsSiteUrl}.docs.buildwithfern.com`;

    // Replace placeholders in fern.config.json
    await replaceInFile(path.join(fernDir, "fern.config.json"), {
        "{{ORG_NAME}}": data.orgName
    });

    // Replace placeholders in docs.yml
    const docsYmlReplacements: Record<string, string> = {
        "{{DOCS_URL}}": fullUrl,
        "{{TITLE}}": data.docsSiteName
    };
    await replaceInFile(path.join(fernDir, "docs.yml"), docsYmlReplacements);

    // Download and save custom assets if provided
    let hasLogo = false;
    let hasFavicon = false;

    if (data.logoUrl) {
        try {
            const ext = getFileExtensionFromUrl(data.logoUrl);
            await downloadFile(data.logoUrl, path.join(fernDir, "docs", "assets", `logo.${ext}`));
            hasLogo = true;
        } catch (error) {
            console.error("Failed to download logo:", error);
        }
    }

    if (data.faviconUrl) {
        try {
            const ext = getFileExtensionFromUrl(data.faviconUrl);
            await downloadFile(data.faviconUrl, path.join(fernDir, "docs", "assets", `favicon.${ext}`));
            hasFavicon = true;
        } catch (error) {
            console.error("Failed to download favicon:", error);
        }
    }

    // Update docs.yml with custom assets and colors if provided
    const docsYmlPath = path.join(fernDir, "docs.yml");
    const docsYmlContent = await fs.readFile(docsYmlPath, "utf-8");
    const docsConfig = yaml.load(docsYmlContent) as any;

    // Add logo if downloaded
    if (hasLogo && data.logoUrl) {
        const ext = getFileExtensionFromUrl(data.logoUrl);
        docsConfig.logo = {
            dark: `docs/assets/logo.${ext}`,
            light: `docs/assets/logo.${ext}`,
            height: 20
        };
    }

    // Add favicon if downloaded
    if (hasFavicon && data.faviconUrl) {
        const ext = getFileExtensionFromUrl(data.faviconUrl);
        docsConfig.favicon = `docs/assets/favicon.${ext}`;
    }

    // Add colors if provided
    if (data.primaryColorHex) {
        docsConfig.colors = {
            accentPrimary: {
                dark: data.primaryColorHex,
                light: data.primaryColorHex
            }
        };
    }

    // Remove API Reference tab if no OpenAPI specs provided
    if (data.openApiSpecUrls.length === 0) {
        // Remove the API Reference tab from tabs
        if (docsConfig.tabs?.["API Reference"]) {
            delete docsConfig.tabs["API Reference"];
        }

        // Remove the API Reference navigation
        if (docsConfig.navigation) {
            docsConfig.navigation = docsConfig.navigation.filter((nav: any) => nav.tab !== "API Reference");
        }
    }

    // Write updated docs.yml
    await fs.writeFile(
        docsYmlPath,
        `# yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json\n\n${yaml.dump(docsConfig)}`
    );

    // Handle OpenAPI specs and generators.yml
    if (data.openApiSpecUrls.length > 0) {
        // Download OpenAPI specs if provided
        for (const spec of data.openApiSpecUrls) {
            try {
                const { content } = await fetchOpenApiSpec(spec.assetUrl);
                await fs.writeFile(path.join(fernDir, spec.fileName), content);
            } catch (error) {
                console.error(`Failed to download OpenAPI spec ${spec.fileName}:`, error);
            }
        }

        // Update generators.yml with OpenAPI specs
        const generatorsYmlContent = createGeneratorsYml(data.openApiSpecUrls);
        if (generatorsYmlContent) {
            await fs.writeFile(path.join(fernDir, "generators.yml"), generatorsYmlContent);
        }
    } else {
        // Remove generators.yml from template if no OpenAPI specs provided
        try {
            await fs.unlink(path.join(fernDir, "generators.yml"));
        } catch {
            // File might not exist, ignore error
        }
    }
}

async function publishDocsWithFernCli(
    projectDir: string,
    fernToken?: string
): Promise<{ url: string; output: string }> {
    try {
        // Run fern generate --docs using npx (works in serverless environments)
        // Set FERN_TOKEN and npm cache directory for Vercel compatibility
        const env = {
            ...process.env,
            ...(fernToken && { FERN_TOKEN: fernToken }),
            // Set npm cache to /tmp for serverless environments (no home directory)
            npm_config_cache: "/tmp/.npm",
            NPM_CONFIG_CACHE: "/tmp/.npm"
        };

        // Use npx to run fern-api without global installation (Vercel-compatible)
        // Use echo "y" to bypass interactive confirmation prompt
        const { stdout, stderr } = await execAsync('echo "y" | npx fern-api generate --docs', {
            cwd: projectDir,
            timeout: 180000, // 180 second timeout (3 minutes) for download + generation
            env,
            shell: true
        });

        const output = stdout + stderr;

        // Parse the published URL from output
        // Expected format: "Published docs to https://jacob.docs.buildwithfern.com"
        const urlMatch = output.match(/Published docs to (https:\/\/[^\s]+)/);
        if (!urlMatch) {
            throw new Error("Failed to parse published URL from Fern CLI output");
        }

        return {
            url: urlMatch[1],
            output
        };
    } catch (error: any) {
        console.error("Fern CLI execution failed:", error);
        console.error("Error details:");
        console.error("  stdout:", error.stdout || "none");
        console.error("  stderr:", error.stderr || "none");
        console.error("  message:", error.message || "none");
        throw error;
    }
}

export default async function createOnboardingDocsHandler(
    data: OnboardingDocsRequest,
    fernToken?: string,
    createGithubRepo?: boolean
): Promise<
    MaybeErrorResponse<{
        url: string;
        message: string;
        cliOutput: string;
        fernDocsDownloadUrl: string;
        githubRepoUrl?: string;
    }>
> {
    let tempDir: string | null = null;

    try {
        // Create temporary directory
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "fern-onboarding-"));

        // Normalize the docs URL to always include the suffix
        const normalizedDocsUrl = data.docsSiteUrl.includes(".docs.buildwithfern.com")
            ? data.docsSiteUrl
            : `${data.docsSiteUrl}.docs.buildwithfern.com`;

        // Create the Fern project structure
        await createFernProject(data, tempDir);

        const fernDir = path.join(tempDir, "fern");
        const s3Key = `fern_docs_${normalizedDocsUrl}.zip`;

        console.log("Starting parallel operations: fern generate, S3 upload, and GitHub repo creation");

        // Run all three operations in parallel
        const [publishResult, s3Result, githubResult] = await Promise.all([
            // 1. Publish docs using Fern CLI
            publishDocsWithFernCli(tempDir, fernToken).catch((error) => {
                console.error("Fern CLI execution failed:", error);
                throw error; // Re-throw to fail the entire request
            }),

            // 2. Zip and upload the fern directory to S3
            OnboardS3Service.zipAndUploadDirectory({
                directoryPath: fernDir,
                key: s3Key
            }).catch((error) => {
                console.error("S3 upload failed:", error);
                // Don't fail the entire request for S3 errors
                return { downloadUrl: "" };
            }),

            // 3. Create GitHub repository if requested
            (async () => {
                if (!createGithubRepo) {
                    return { success: false as const, githubRepoUrl: undefined };
                }

                try {
                    // Read all files from the fern directory
                    const files = await readAllFilesFromDirectory(fernDir);

                    // Create a repository name from the docs site URL
                    const repoName = data.docsSiteUrl.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

                    // Use the demo creation bot's GitHub username/org from environment variable
                    const demoCreationBotOwner = process.env.FERN_DEMO_CREATION_BOT_OWNER;

                    if (!demoCreationBotOwner) {
                        console.error("FERN_DEMO_CREATION_BOT_OWNER environment variable is not set");
                        return { success: false as const, githubRepoUrl: undefined };
                    }

                    const result = await postGitRepository({
                        orgName: data.orgName,
                        owner: demoCreationBotOwner,
                        repoName,
                        description: `Fern documentation for ${data.docsSiteName}`,
                        isPrivate: true,
                        files,
                        site: normalizedDocsUrl
                    });

                    if (result.success) {
                        return { success: true as const, githubRepoUrl: result.htmlUrl };
                    } else {
                        console.error("Failed to create GitHub repository:", result.error);
                        return { success: false as const, githubRepoUrl: undefined };
                    }
                } catch (error) {
                    console.error("Failed to create GitHub repository:", error);
                    return { success: false as const, githubRepoUrl: undefined };
                }
            })()
        ]);

        const { url, output } = publishResult;
        const { downloadUrl } = s3Result;
        const githubRepoUrl = githubResult.githubRepoUrl;

        // If GitHub repo was created, link it to the docs site
        if (githubRepoUrl && fernToken) {
            try {
                const postDocsGithubSourceHandler = (await import("@/app/api/post-docs-github-source/handler")).default;

                await postDocsGithubSourceHandler({
                    url: normalizedDocsUrl,
                    token: fernToken,
                    githubUrl: githubRepoUrl.replace("fern-support", "fern-demo")
                });
                console.log("Successfully linked GitHub repo to docs site");
            } catch (error) {
                console.error("Failed to link GitHub repo to docs site:", error);
                // Don't fail the entire request if linking fails
            }
        }

        return {
            data: {
                url,
                message: "Documentation published successfully",
                cliOutput: output,
                fernDocsDownloadUrl: downloadUrl,
                githubRepoUrl
            }
        };
    } catch (error) {
        console.error("Error creating docs:", error);
        return {
            errorResponse: NextResponse.json(
                {
                    error: "Failed to create documentation",
                    message: error instanceof Error ? error.message : "Unknown error"
                },
                { status: 500 }
            )
        };
    } finally {
        // Cleanup temporary directory
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.error("Failed to cleanup temp directory:", cleanupError);
            }
        }
    }
}
