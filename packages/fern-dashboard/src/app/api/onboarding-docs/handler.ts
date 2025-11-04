import "server-only";

import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import * as yaml from "js-yaml";
import { NextResponse } from "next/server";

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
        if (docsConfig.tabs && docsConfig.tabs["API Reference"]) {
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
        // Install fern-api globally and run fern generate --docs
        // Set FERN_TOKEN environment variable if provided
        const env = {
            ...process.env,
            ...(fernToken && { FERN_TOKEN: fernToken })
        };

        // Install fern-api globally
        await execAsync("npm install -g fern-api", {
            cwd: projectDir,
            timeout: 60000 // 60 second timeout for installation
        });

        // Run fern generate --docs
        // Use echo "y" to bypass interactive confirmation prompt
        const { stdout, stderr } = await execAsync('echo "y" | fern generate --docs', {
            cwd: projectDir,
            timeout: 120000, // 120 second timeout (2 minutes) for docs generation
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
    fernToken?: string
): Promise<
    MaybeErrorResponse<{
        url: string;
        message: string;
        cliOutput: string;
        fernDocsDownloadUrl: string;
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

        // Publish docs using Fern CLI
        const { url, output } = await publishDocsWithFernCli(tempDir, fernToken);

        // Zip and upload the fern directory to S3
        const fernDir = path.join(tempDir, "fern");
        const s3Key = `fern_docs_${normalizedDocsUrl}.zip`;

        const { downloadUrl } = await OnboardS3Service.zipAndUploadDirectory({
            directoryPath: fernDir,
            key: s3Key
        });

        return {
            data: {
                url,
                message: "Documentation published successfully",
                cliOutput: output,
                fernDocsDownloadUrl: downloadUrl
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
