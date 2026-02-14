import { fernCliConfig } from "@/utils/fernCliConfig";

import { TEMPLATE_FILES, type TemplateFile } from "./generated-templates";

export type { TemplateFile };

const WORKFLOW_PATHS = new Set([
    ".github/workflows/check.yml",
    ".github/workflows/preview-docs.yml",
    ".github/workflows/publish-docs.yml"
]);

function applyCliSubstitutions(files: TemplateFile[]): TemplateFile[] {
    if (fernCliConfig.npmPackage === "fern-api") {
        return files;
    }
    return files.map((file) => {
        if (!WORKFLOW_PATHS.has(file.path)) {
            return file;
        }
        return {
            ...file,
            content: file.content
                .replace(/npm install -g fern-api/g, `npm install -g ${fernCliConfig.npmPackage}`)
                .replace(/run: fern /g, `run: ${fernCliConfig.cliCommand} `)
                .replace(/\$\(fern /g, `$(${fernCliConfig.cliCommand} `)
        };
    });
}

/**
 * Gets all docs-starter template files.
 *
 * Returns an array of files with their relative paths and content.
 * Binary files are base64 encoded.
 */
export async function getDocsStarterTemplateFiles(): Promise<TemplateFile[]> {
    return applyCliSubstitutions(TEMPLATE_FILES);
}

/**
 * Gets a subset of essential files for initial repo setup (without full docs content).
 * This is used for the set-up-repo route to create a minimal working repo quickly.
 */
export async function getEssentialTemplateFiles(): Promise<TemplateFile[]> {
    // Essential files for a working Fern docs repo:
    // - fern/fern.config.json (required for fern CLI)
    // - fern/docs.yml (required for docs generation)
    // - .github/workflows/publish-docs.yml (for CI/CD)
    // - fern/docs/pages/welcome.mdx (at least one page)
    // - fern/docs/assets/favicon.svg (default favicon)
    // - fern/docs/assets/logo.svg (default logo)
    const essentialPaths = [
        "fern/fern.config.json",
        "fern/docs.yml",
        ".github/workflows/publish-docs.yml",
        "fern/docs/pages/welcome.mdx",
        "fern/docs/assets/favicon.svg",
        "fern/docs/assets/logo.svg"
    ];

    return applyCliSubstitutions(TEMPLATE_FILES.filter((file) => essentialPaths.includes(file.path)));
}
