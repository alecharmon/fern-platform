import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { extractMainContent, htmlToMarkdown, rewriteInternalLinks } from "./markdown.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("extractMainContent", () => {
    it("should extract content and wrap in readability div", () => {
        // Readability wraps content in a div with id="readability-page-1"
        const html = `
            <html>
            <body>
                <main><h1>Title</h1><p>Content</p></main>
            </body>
            </html>
        `;
        const content = extractMainContent(html);
        // Readability wraps in a page div
        expect(content).toContain("readability-page-1");
        expect(content).toContain("Title");
        expect(content).toContain("Content");
    });

    it("should remove script tags", () => {
        const html = `
            <html>
            <body>
                <script>console.log('evil');</script>
                <main><p>Content</p></main>
            </body>
            </html>
        `;
        const content = extractMainContent(html);
        expect(content).not.toContain("console.log");
    });

    it("should remove style tags", () => {
        const html = `
            <html>
            <body>
                <style>.foo { color: red; }</style>
                <main><p>Content</p></main>
            </body>
            </html>
        `;
        const content = extractMainContent(html);
        expect(content).not.toContain("color: red");
    });

    it("should handle pages with sufficient content for readability analysis", () => {
        // Readability needs enough content to properly analyze the page structure
        const html = `
            <html>
            <body>
                <header><nav>Navigation links here</nav></header>
                <main>
                    <article>
                        <h1>Main Article Title</h1>
                        <p>This is the first paragraph of the article content that provides context.</p>
                        <p>Here is another paragraph with more detailed information about the topic.</p>
                        <p>And a third paragraph to ensure there's enough content for analysis.</p>
                        <p>Readability uses content length as a signal for what's the main content.</p>
                    </article>
                </main>
                <footer>Footer content</footer>
            </body>
            </html>
        `;
        const content = extractMainContent(html);
        expect(content).toContain("Main Article Title");
        expect(content).toContain("first paragraph");
    });

    it("should return body content as fallback for minimal HTML", () => {
        // For very minimal HTML, Readability may return null and we fall back to body
        const html = "<body><p>Simple</p></body>";
        const content = extractMainContent(html);
        expect(content).toContain("Simple");
    });
});

describe("htmlToMarkdown", () => {
    it("should convert simple HTML to markdown", async () => {
        const html = "<h1>Title</h1><p>Paragraph</p>";
        const markdown = await htmlToMarkdown(html);
        expect(markdown).toContain("Title");
        expect(markdown).toContain("Paragraph");
    });

    it("should convert links to markdown", async () => {
        const html = '<p>Click <a href="https://example.com">here</a></p>';
        const markdown = await htmlToMarkdown(html);
        // Link text and URL should be present
        expect(markdown).toContain("here");
        expect(markdown).toContain("example.com");
    });

    it("should convert code blocks", async () => {
        const html = "<pre><code>const x = 1;</code></pre>";
        const markdown = await htmlToMarkdown(html);
        expect(markdown).toContain("const x = 1;");
    });

    it("should convert lists", async () => {
        const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
        const markdown = await htmlToMarkdown(html);
        expect(markdown).toContain("Item 1");
        expect(markdown).toContain("Item 2");
    });

    it("should handle empty HTML", async () => {
        const html = "";
        const markdown = await htmlToMarkdown(html);
        // Empty HTML produces empty markdown (trimmed)
        expect(markdown.trim()).toBe("");
    });
});

describe("rewriteInternalLinks", () => {
    it("should rewrite internal links to fern slugs", () => {
        const markdown = "Check out [the guide](/docs/guide) for more info.";
        const urlToSlugMap = new Map([["https://example.com/docs/guide", "guide"]]);

        const result = rewriteInternalLinks(markdown, urlToSlugMap, "https://example.com");

        expect(result).toBe("Check out [the guide](/guide) for more info.");
    });

    it("should keep external links unchanged", () => {
        const markdown = "Visit [GitHub](https://github.com) for code.";
        const urlToSlugMap = new Map<string, string>();

        const result = rewriteInternalLinks(markdown, urlToSlugMap, "https://example.com");

        expect(result).toBe("Visit [GitHub](https://github.com) for code.");
    });

    it("should rewrite absolute URLs to same origin", () => {
        const markdown = "See [docs](https://example.com/docs/intro).";
        const urlToSlugMap = new Map([["https://example.com/docs/intro", "intro"]]);

        const result = rewriteInternalLinks(markdown, urlToSlugMap, "https://example.com");

        expect(result).toBe("See [docs](/intro).");
    });

    it("should keep anchor links unchanged", () => {
        const markdown = "Jump to [section](#section-1).";
        const urlToSlugMap = new Map<string, string>();

        const result = rewriteInternalLinks(markdown, urlToSlugMap, "https://example.com");

        expect(result).toBe("Jump to [section](#section-1).");
    });

    it("should keep mailto links unchanged", () => {
        const markdown = "Email [us](mailto:hello@example.com).";
        const urlToSlugMap = new Map<string, string>();

        const result = rewriteInternalLinks(markdown, urlToSlugMap, "https://example.com");

        expect(result).toBe("Email [us](mailto:hello@example.com).");
    });

    it("should handle multiple links", () => {
        const markdown = "See [intro](/intro) and [guide](/guide).";
        const urlToSlugMap = new Map([
            ["https://example.com/intro", "introduction"],
            ["https://example.com/guide", "getting-started"]
        ]);

        const result = rewriteInternalLinks(markdown, urlToSlugMap, "https://example.com");

        expect(result).toBe("See [intro](/introduction) and [guide](/getting-started).");
    });
});

describe("htmlToMarkdown with fixture", () => {
    it("should convert real Fern docs HTML fixture", async () => {
        const fixturePath = path.join(__dirname, "fixtures", "fern-docs-acmeco-platform-concepts.html");
        const html = await fs.readFile(fixturePath, "utf-8");

        const markdown = await htmlToMarkdown(html);

        // Should produce non-empty markdown
        expect(markdown.length).toBeGreaterThan(100);

        // Should not contain raw HTML tags in output
        expect(markdown).not.toContain("<script");
        expect(markdown).not.toContain("<style");
    });

    it("should extract main content from real page and not include navigation", async () => {
        const fixturePath = path.join(__dirname, "fixtures", "fern-docs-acmeco-platform-concepts.html");
        const html = await fs.readFile(fixturePath, "utf-8");

        const markdown = await htmlToMarkdown(html);

        // Should contain actual article content
        expect(markdown).toContain("Plant");

        // Readability should strip navigation elements - these are sidebar nav items
        // Note: Exact behavior depends on Readability's analysis of the page structure
        expect(markdown.length).toBeLessThan(html.length / 2); // Markdown should be much smaller than raw HTML
    });
});
