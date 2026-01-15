import type { CategoryResult, DocsScoreIssue, PageData } from "./types";

/**
 * Checks SEO issues for a single page's HTML content.
 * Returns an array of issues found with severity levels:
 * - high: Missing meta description
 * - medium: Missing og:image, Missing alt text
 */
export function checkPageSeo(html: string, url: string): DocsScoreIssue[] {
    const issues: DocsScoreIssue[] = [];

    // Check for missing meta description (high severity)
    if (
        !/<meta[^>]*name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html) &&
        !/<meta[^>]*content=["'][^"']+["'][^>]*name=["']description["'][^>]*>/i.test(html)
    ) {
        issues.push({
            page: url,
            issueType: "Missing meta description",
            suggestedFix: "Add a meta description tag to improve search result snippets",
            severity: "high"
        });
    }

    // Check for missing og:image (medium severity)
    if (
        !/<meta[^>]*property=["']og:image["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html) &&
        !/<meta[^>]*content=["'][^"']+["'][^>]*property=["']og:image["'][^>]*>/i.test(html)
    ) {
        issues.push({
            page: url,
            issueType: "Missing og:image",
            suggestedFix: "Add an og:image meta tag for better social media sharing",
            severity: "medium"
        });
    }

    // Check for images missing alt text (medium severity)
    const imgsWithoutAlt = html.match(/<img(?![^>]*\balt=["'][^"']*["'])[^>]*>/gi);
    if (imgsWithoutAlt && imgsWithoutAlt.length > 0) {
        issues.push({
            page: url,
            issueType: `${imgsWithoutAlt.length} image(s) missing alt text`,
            suggestedFix: "Add descriptive alt attributes to all images for accessibility and SEO",
            severity: "medium"
        });
    }

    return issues;
}

/**
 * Checks SEO issues for multiple pages.
 * Returns a CategoryResult with all issues found.
 */
export function checkSeo(pages: PageData[]): CategoryResult {
    const issues: DocsScoreIssue[] = [];

    for (const page of pages) {
        const pageIssues = checkPageSeo(page.html, page.url);
        issues.push(...pageIssues);
    }

    return { categoryName: "SEO", issues };
}
