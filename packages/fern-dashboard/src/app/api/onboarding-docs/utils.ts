import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as yaml from "js-yaml";

import type { OnboardingDocsRequest } from "./types";

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

async function _copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await _copyDirectory(srcPath, destPath);
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

export async function createFernProject(
    data: OnboardingDocsRequest,
    tempDir: string,
    onLog?: (message: string) => void
): Promise<void> {
    // Note: Git clone is now handled by the caller to stream output
    // This function assumes the docs-starter repo has been cloned to tempDir
    const fernDir = path.join(tempDir, "fern");

    // Ensure URL has .docs.buildwithfern.com suffix
    const fullUrl = data.docsSiteUrl.includes(".docs.buildwithfern.com")
        ? data.docsSiteUrl
        : `${data.docsSiteUrl}.docs.buildwithfern.com`;

    // Replace placeholders in fern.config.json (from docs-starter default: "plantstore")
    await replaceInFile(path.join(fernDir, "fern.config.json"), {
        plantstore: data.orgName
    });

    // Replace placeholders in docs.yml
    const docsYmlReplacements: Record<string, string> = {
        "plantstore.docs.buildwithfern.com": fullUrl,
        "Plant Store": data.docsSiteName
    };
    await replaceInFile(path.join(fernDir, "docs.yml"), docsYmlReplacements);

    // Download and save custom assets if provided
    let hasLogo = false;
    let hasFavicon = false;

    const assetsDir = path.join(fernDir, "docs", "assets");

    if (data.logoUrl) {
        try {
            // Remove existing logo files before adding custom one
            const existingAssets = await fs.readdir(assetsDir);
            const logoFilesToRemove = ["logo.", "logo-dark.", "logo-light.", "fern-logo-primary.", "fern-logo-white."];

            for (const file of existingAssets) {
                // Remove any default logo files (includes Fern branding and docs-starter defaults)
                if (logoFilesToRemove.some((prefix) => file.startsWith(prefix))) {
                    const filePath = path.join(assetsDir, file);
                    await fs.unlink(filePath);
                }
            }

            const ext = getFileExtensionFromUrl(data.logoUrl);
            await downloadFile(data.logoUrl, path.join(assetsDir, `logo.${ext}`));
            hasLogo = true;
        } catch (error) {
            console.error("Failed to download logo:", error);
        }
    }

    if (data.faviconUrl) {
        try {
            // Remove existing favicon files before adding custom one
            const existingAssets = await fs.readdir(assetsDir);
            for (const file of existingAssets) {
                if (file.startsWith("favicon.")) {
                    const filePath = path.join(assetsDir, file);
                    await fs.unlink(filePath);
                }
            }

            const ext = getFileExtensionFromUrl(data.faviconUrl);
            await downloadFile(data.faviconUrl, path.join(assetsDir, `favicon.${ext}`));
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
