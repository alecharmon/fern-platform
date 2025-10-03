import { htmlToMdx } from "@fern-docs/mdx";

import { PageData } from "./types";
import { StoredNavigationData } from "./types";

export function createMdxFrontmatter(config: { title: string; slug?: string; subtitle?: string }): string {
    // Always include the title, even if it's an empty string
    const frontmatterLines = [`title: ${config.title ?? "''"}`];

    // Optionally include the subtitle and slug if they are provided
    if (config.subtitle) {
        frontmatterLines.push(`subtitle: ${config.subtitle ?? "''"}`);
    }
    if (config.slug) {
        frontmatterLines.push(`slug: ${config.slug ?? "''"}`);
    }

    return `---
${frontmatterLines.join("\n")}
---`;
}

export function pageDataToMdx(pageData: PageData): string {
    return htmlToMdx(pageData.html, pageData.frontmatter).mdx;
}

export function getPageFilename(slug: string): string {
    return slug.endsWith(".mdx") ? slug : `${slug}.mdx`;
}

export function loadPageData(navigationData: StoredNavigationData, filename: string) {
    return navigationData.pageContents[filename];
}

export function loadAllPageData(navigationData: StoredNavigationData) {
    return navigationData.pageContents;
}

export function savePageData(
    navigationData: StoredNavigationData,
    pageDataUpdates: Record<string, PageData>
): Partial<StoredNavigationData> {
    const updatedPageContents = { ...navigationData.pageContents };

    Object.entries(pageDataUpdates).forEach(([filename, pageData]) => {
        updatedPageContents[filename] = {
            ...pageData,
            lastModified: Date.now(),
            pageType: "server"
        };
    });

    return { pageContents: updatedPageContents };
}
