import { TEMPLATE_FILES, type TemplateFile } from "./generated-templates";

export type { TemplateFile };

const LLMS_FULL_TXT_URL = "https://buildwithfern.com/learn/docs/llms-full.txt";

/**
 * Fetches the CLAUDE.md content from the Fern docs LLM page.
 * Returns null if the fetch fails.
 */
async function fetchClaudeMdContent(): Promise<string | null> {
    try {
        const response = await fetch(LLMS_FULL_TXT_URL);
        if (!response.ok) {
            console.warn(`[fetchClaudeMdContent] Failed to fetch llms-full.txt: ${response.status}`);
            return null;
        }
        const content = await response.text();
        const currentDate = new Date().toISOString().split("T")[0];
        const header = `###########
About this page.
This is a fetch of <${LLMS_FULL_TXT_URL}> - dated on ${currentDate}
We've automatically included this file to aid any LLM assistants with making efficient edits to your documentation repo.
Happy documenting!
###########

`;
        return header + content;
    } catch (error) {
        console.warn("[fetchClaudeMdContent] Error fetching llms-full.txt:", error);
        return null;
    }
}

/**
 * Gets all docs-starter template files.
 *
 * Returns an array of files with their relative paths and content.
 * Binary files are base64 encoded.
 * Includes a dynamically fetched CLAUDE.md file if the fetch succeeds.
 */
export async function getDocsStarterTemplateFiles(): Promise<TemplateFile[]> {
    const files = [...TEMPLATE_FILES];

    const claudeMdContent = await fetchClaudeMdContent();
    if (claudeMdContent) {
        files.push({
            path: "fern/CLAUDE.md",
            content: claudeMdContent
        });
    }

    return files;
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

    return TEMPLATE_FILES.filter((file) => essentialPaths.includes(file.path));
}
