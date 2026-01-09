import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

/**
 * Result of content extraction, including the HTML content and metadata.
 */
export interface ExtractedContent {
    /** The extracted HTML content */
    html: string;
    /** Plain text version for analysis */
    textContent: string;
    /** Whether this appears to be a 404 error page */
    isSoft404: boolean;
}

/**
 * Detects if extracted content appears to be a soft 404 page.
 * This is checked AFTER Readability extraction, so we're looking at the
 * actual page content without navigation/footer noise.
 *
 * A soft 404 is detected when:
 * - Content is very short (< 200 chars) AND contains "404" or "not found"
 *
 * @param textContent - Plain text content extracted from the page
 * @returns true if the content appears to be a 404 error page
 */
export function isSoft404Content(textContent: string): boolean {
    const trimmed = textContent.trim();
    const lowerContent = trimmed.toLowerCase();

    // Very short content with 404 indicators is a soft 404
    // 200 chars is roughly 1-2 sentences - a real page would have more
    if (trimmed.length < 200) {
        if (
            lowerContent.includes("404") ||
            lowerContent.includes("not found") ||
            lowerContent.includes("page doesn't exist") ||
            lowerContent.includes("page does not exist") ||
            lowerContent.includes("couldn't find") ||
            lowerContent.includes("could not find")
        ) {
            return true;
        }
    }

    return false;
}

/**
 * Extracts the main content from a full HTML page using Mozilla Readability.
 * This is the same algorithm that powers Firefox's Reader Mode.
 *
 * Works with any website - automatically strips navigation, sidebars, headers,
 * footers, ads, and other non-content elements.
 *
 * @param html - Full HTML page content
 * @param url - Optional URL for resolving relative links
 * @returns Extracted content with HTML, text, and soft 404 detection
 */
export function extractMainContent(html: string, url?: string): ExtractedContent {
    // Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });

    // Clone document since Readability modifies it
    const documentClone = dom.window.document.cloneNode(true) as Document;

    // Use Mozilla Readability to extract article content
    const reader = new Readability(documentClone, {
        // Lower threshold to allow for shorter documentation pages
        charThreshold: 100
    });

    const article = reader.parse();

    if (article?.content) {
        const textContent = article.textContent ?? "";
        return {
            html: article.content,
            textContent,
            isSoft404: isSoft404Content(textContent)
        };
    }

    // Fallback: return body content if Readability fails
    const bodyHtml = dom.window.document.body?.innerHTML ?? html;
    const bodyText = dom.window.document.body?.textContent ?? "";
    return {
        html: bodyHtml,
        textContent: bodyText,
        isSoft404: isSoft404Content(bodyText)
    };
}

/**
 * Result of HTML to markdown conversion.
 */
export interface MarkdownConversionResult {
    /** The converted markdown content */
    markdown: string;
    /** Whether the source page was detected as a soft 404 */
    isSoft404: boolean;
}

/**
 * Converts HTML content to GitHub Flavored Markdown using unified/rehype-remark.
 *
 * @param html - HTML content to convert
 * @param url - Optional URL for resolving relative links during extraction
 * @returns Markdown conversion result with soft 404 detection
 */
export async function htmlToMarkdown(html: string, url?: string): Promise<MarkdownConversionResult> {
    // Use Readability for content extraction
    const extracted = extractMainContent(html, url);

    // Wrap in a div to ensure valid HTML structure for parsing
    const wrappedContent = `<div>${extracted.html}</div>`;

    const processor = unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeRemark)
        .use(remarkGfm)
        .use(remarkStringify);

    const result = await processor.process(wrappedContent);
    let markdown = String(result);

    // Clean up common artifacts
    markdown = cleanupMarkdown(markdown);

    return {
        markdown,
        isSoft404: extracted.isSoft404
    };
}

/**
 * Cleans up common artifacts in converted markdown.
 */
function cleanupMarkdown(markdown: string): string {
    let result = markdown;

    // Remove HTML comments (<!-- ... -->)
    result = result.replace(/<!--[\s\S]*?-->/g, "");

    // Escape curly braces outside of code blocks/inline code to prevent MDX parsing errors
    // MDX interprets {} as JSX expressions, so we need to escape them
    result = escapeCurlyBraces(result);

    // Remove excessive blank lines (more than 2 consecutive)
    result = result.replace(/\n{3,}/g, "\n\n");

    // Remove trailing whitespace from lines
    result = result.replace(/[ \t]+$/gm, "");

    // Trim leading/trailing whitespace from the whole document
    result = result.trim();

    // Ensure file ends with newline
    if (result && !result.endsWith("\n")) {
        result += "\n";
    }

    return result;
}

/**
 * Escapes curly braces in markdown content that are outside of code blocks and inline code.
 * This prevents MDX from interpreting them as JSX expressions.
 */
function escapeCurlyBraces(markdown: string): string {
    const result: string[] = [];
    let i = 0;

    while (i < markdown.length) {
        // Check for fenced code block (```)
        if (markdown.slice(i, i + 3) === "```") {
            const endIndex = markdown.indexOf("```", i + 3);
            if (endIndex !== -1) {
                // Include the entire code block as-is
                result.push(markdown.slice(i, endIndex + 3));
                i = endIndex + 3;
                continue;
            }
        }

        // Check for inline code (`)
        if (markdown[i] === "`") {
            // Find the closing backtick
            const endIndex = markdown.indexOf("`", i + 1);
            if (endIndex !== -1) {
                // Include the entire inline code as-is
                result.push(markdown.slice(i, endIndex + 1));
                i = endIndex + 1;
                continue;
            }
        }

        // Escape curly braces outside of code
        if (markdown[i] === "{") {
            result.push("\\{");
            i++;
            continue;
        }
        if (markdown[i] === "}") {
            result.push("\\}");
            i++;
            continue;
        }

        // Regular character
        result.push(markdown[i]!);
        i++;
    }

    return result.join("");
}

/**
 * Rewrites internal links in markdown to use Fern slugs.
 *
 * @param markdown - Markdown content with original links
 * @param urlToSlugMap - Map of source URL → fernSlug
 * @param baseUrl - Base URL of the source site (for resolving relative URLs)
 * @returns Markdown with rewritten links
 */
export function rewriteInternalLinks(markdown: string, urlToSlugMap: Map<string, string>, baseUrl: string): string {
    const base = new URL(baseUrl);

    // Match markdown links: [text](url)
    return markdown.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (match, text: string, url: string) => {
        // Skip external links, anchors, and special protocols
        if (
            url.startsWith("http://") ||
            url.startsWith("https://") ||
            url.startsWith("#") ||
            url.startsWith("mailto:") ||
            url.startsWith("tel:")
        ) {
            // For absolute URLs to the same origin, try to rewrite
            if (url.startsWith("http://") || url.startsWith("https://")) {
                try {
                    const parsed = new URL(url);
                    if (parsed.origin === base.origin) {
                        // Same origin - try to find in map
                        const slug = urlToSlugMap.get(url);
                        if (slug !== undefined) {
                            return `[${text}](/${slug})`;
                        }
                    }
                } catch {
                    // Invalid URL, keep original
                }
            }
            return match;
        }

        // Relative URL - resolve against base and look up
        try {
            const resolved = new URL(url, base);
            const normalizedUrl = resolved.toString().replace(/\/$/, ""); // Remove trailing slash

            const slug = urlToSlugMap.get(normalizedUrl);
            if (slug !== undefined) {
                return `[${text}](/${slug})`;
            }

            // Not found in map - might be an internal link we didn't crawl
            // Keep it relative but clean up the path
            return `[${text}](${url})`;
        } catch {
            // Invalid URL, keep original
            return match;
        }
    });
}

/**
 * Generates YAML frontmatter for a markdown page.
 *
 * @param title - Page title
 * @param subtitle - Optional subtitle/description
 * @returns Frontmatter string including the --- delimiters
 */
export function generateFrontmatter(title: string, subtitle?: string): string {
    let frontmatter = "---\n";
    frontmatter += `title: ${escapeYamlString(title)}\n`;
    if (subtitle) {
        frontmatter += `subtitle: ${escapeYamlString(subtitle)}\n`;
    }
    frontmatter += "---\n\n";
    return frontmatter;
}

/**
 * Escapes a string for use in YAML.
 * Wraps in quotes if it contains special characters.
 */
function escapeYamlString(str: string): string {
    // If string contains colons, quotes, or newlines, wrap in quotes and escape inner quotes
    if (str.includes(":") || str.includes('"') || str.includes("'") || str.includes("\n") || str.includes("#")) {
        return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
}

/**
 * Result of converting a page to markdown.
 */
export interface PageConversionResult {
    /** Whether the page was successfully converted (false if soft 404) */
    success: boolean;
    /** Whether the page was detected as a soft 404 */
    isSoft404: boolean;
}

/**
 * Converts a page's HTML to markdown and assigns it to the page.
 * If the page is detected as a soft 404, markdown will not be set.
 *
 * @param page - PageNode with html property
 * @param urlToSlugMap - Map for link rewriting
 * @param baseUrl - Base URL for resolving relative links
 * @returns Conversion result indicating success and soft 404 detection
 */
export async function convertPageToMarkdown(
    page: { html: string; markdown?: string; url: string; title: string; description?: string },
    urlToSlugMap: Map<string, string>,
    baseUrl: string
): Promise<PageConversionResult> {
    // Pass URL for better relative link resolution
    const result = await htmlToMarkdown(page.html, page.url);

    // Don't set markdown for soft 404 pages - they'll be skipped during file writing
    if (result.isSoft404) {
        return { success: false, isSoft404: true };
    }

    const rewrittenMarkdown = rewriteInternalLinks(result.markdown, urlToSlugMap, baseUrl);

    // Prepend frontmatter with title and subtitle
    const frontmatter = generateFrontmatter(page.title, page.description);
    page.markdown = frontmatter + rewrittenMarkdown;

    return { success: true, isSoft404: false };
}
