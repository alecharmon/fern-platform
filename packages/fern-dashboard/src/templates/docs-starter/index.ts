import { fernCliConfig, type FernCliConfig } from "@/utils/fernCliConfig";

import { TEMPLATE_FILES, type TemplateFile } from "./generated-templates";

export type { TemplateFile };

export const WORKFLOW_PATHS = new Set([
    ".github/workflows/check.yml",
    ".github/workflows/preview-docs.yml",
    ".github/workflows/publish-docs.yml"
]);

export function applySubstitutions(files: TemplateFile[], config: FernCliConfig = fernCliConfig): TemplateFile[] {
    return files.map((file) => {
        let { content } = file;

        if (config.docsDomain !== "docs.buildwithfern.com") {
            content = content.replace(/docs\.buildwithfern\.com/g, config.docsDomain);
        }

        if (config.npmPackage !== "fern-api" && WORKFLOW_PATHS.has(file.path)) {
            content = content
                .replace(
                    /- name: Setup Node\.js\n\s+uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: "lts\/\*"\n\n\s+- name: Install Fern CLI tool\n\s+uses: fern-api\/setup-fern-cli@v1/g,
                    `- name: Install Fern CLI tool\n        run: npm install -g ${config.npmPackage}`
                )
                .replace(/run: fern /g, `run: ${config.cliCommand} `)
                .replace(/\$\(fern /g, `$(${config.cliCommand} `);
        }

        if (content === file.content) {
            return file;
        }
        return { ...file, content };
    });
}

/**
 * Gets all docs-starter template files.
 *
 * Returns an array of files with their relative paths and content.
 * Binary files are base64 encoded.
 */
export async function getDocsStarterTemplateFiles(): Promise<TemplateFile[]> {
    return applySubstitutions(TEMPLATE_FILES);
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

    return applySubstitutions(TEMPLATE_FILES.filter((file) => essentialPaths.includes(file.path)));
}
