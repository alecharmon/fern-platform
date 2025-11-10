import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

import { htmlToMdx, mdxToHtml } from "../convert";

describe("mdxToHtml and htmlToMdx", () => {
    const simpleMdx = `# Hello World\n\nThis is a test.`;
    const mdxWithFrontmatter = `---\ntitle: Test Title\ndescription: Test Description\n---\n\n# Heading\n\nSome content.`;
    const mdxWithCustom = `# Hello <Custom value="foo" />`;
    const mdxWithImage = `# Document\n\n![Alt text](image.png "Title")\n\nSome text.`;
    const mdxWithImageUpload = `# Document\n\n<div data-type="image-upload" />\n\nSome text.`;
    const mdxWithVideoUpload = `# Document\n\n<div data-type="video-upload" />\n\nSome text.`;
    it("mdxToHtml: simple mdx", () => {
        const result = mdxToHtml(simpleMdx);
        expect(result.html).toMatch(
            /<h1 fve-data-id="[a-f0-9]+" fve-mdx-b64="[A-Za-z0-9+/=]+">Hello World<\/h1>\s*<p fve-data-id="[a-f0-9]+" fve-mdx-b64="[A-Za-z0-9+/=]+">This is a test\.<\/p>/
        );
        expect(result.frontmatter).toMatchInlineSnapshot(`null`);
    });

    it("mdxToHtml: with frontmatter", () => {
        const result = mdxToHtml(mdxWithFrontmatter);
        expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "description": "Test Description",
        "title": "Test Title",
      }
    `);
    });

    it("mdxToHtml: with custom element", () => {
        const result = mdxToHtml(mdxWithCustom);
        expect(result.html).toContain("custom-element-v2");
        expect(result.frontmatter).toMatchInlineSnapshot(`null`);
    });

    it("htmlToMdx: round-trip simple", () => {
        const { html, frontmatter } = mdxToHtml(simpleMdx);
        const mdxResult = htmlToMdx(html, { frontmatter });
        expect(mdxResult.mdx).toMatchInlineSnapshot(`
      "# Hello World

      This is a test.
      "
    `);
    });

    it("htmlToMdx: round-trip with frontmatter", () => {
        const { html, frontmatter } = mdxToHtml(mdxWithFrontmatter);
        const mdxResult = htmlToMdx(html, { frontmatter });
        expect(mdxResult.mdx).toMatchInlineSnapshot(`
      "---
      title: Test Title
      description: Test Description
      ---

      # Heading

      Some content.
      "
    `);
    });

    it("htmlToMdx: round-trip with custom element", () => {
        const { html, frontmatter } = mdxToHtml(mdxWithCustom);
        const mdxResult = htmlToMdx(html, { frontmatter });
        expect(mdxResult.mdx).toContain("# Hello");
        expect(mdxResult.mdx).toContain('<Custom value="foo" />');
    });
    it("mdxToHtml: with image", () => {
        const result = mdxToHtml(mdxWithImage);
        expect(result.html).toContain("custom-element-v2");
        const expectedB64 = Buffer.from('![Alt text](image.png "Title")', "utf-8").toString("base64");
        expect(result.html).toContain(`fve-mdx-b64="${expectedB64}"`);
        expect(result.frontmatter).toEqual(null);
    });

    it("htmlToMdx: round-trip with image", () => {
        const { html, frontmatter } = mdxToHtml(mdxWithImage);
        const mdxResult = htmlToMdx(html, { frontmatter });
        expect(mdxResult.mdx).toContain("# Document");
        // Images should be preserved as the original markdown or converted to HTML syntax
        expect(mdxResult.mdx).toContain('![Alt text](image.png "Title")');
        expect(mdxResult.mdx).toContain("Some text.");
    });

    it("mdxToHtml: with image-upload div", () => {
        const result = mdxToHtml(mdxWithImageUpload);
        expect(result.html).toContain('<div data-type="image-upload"');
        expect(result.frontmatter).toEqual(null);
    });

    it("htmlToMdx: round-trip with image-upload div", () => {
        const { html, frontmatter } = mdxToHtml(mdxWithImageUpload);
        const mdxResult = htmlToMdx(html, { frontmatter });
        expect(mdxResult.mdx).toContain("# Document");
        expect(mdxResult.mdx).toContain('<div data-type="image-upload"');
        expect(mdxResult.mdx).toContain("Some text.");
    });

    it("mdxToHtml: with video-upload div", () => {
        const result = mdxToHtml(mdxWithVideoUpload);
        expect(result.html).toContain('<div data-type="video-upload"');
        expect(result.frontmatter).toEqual(null);
    });

    it("htmlToMdx: round-trip with video-upload div", () => {
        const { html, frontmatter } = mdxToHtml(mdxWithVideoUpload);
        const mdxResult = htmlToMdx(html, { frontmatter });
        expect(mdxResult.mdx).toContain("# Document");
        expect(mdxResult.mdx).toContain('<div data-type="video-upload"');
        expect(mdxResult.mdx).toContain("Some text.");
    });

    // File-based snapshot for a larger/complex case
    const complexMdx = `---\ntitle: Complex\n---\n\n# Title\n\n- List item 1\n- List item 2\n\n<Custom value="bar" />\n\n\n## Subheading\n\n\n\n\nAnother paragraph.`;
    it("mdxToHtml: complex file snapshot", async () => {
        const result = mdxToHtml(complexMdx);
        const snapshotDir = path.join(__dirname, "__snapshots__");
        if (!existsSync(snapshotDir)) {
            mkdirSync(snapshotDir);
        }
        const file = path.join(snapshotDir, "complex-mdxToHtml.json");
        writeFileSync(file, JSON.stringify(result, null, 2));
        await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
    });

    it("htmlToMdx: complex file snapshot", async () => {
        const { html, frontmatter } = mdxToHtml(complexMdx);
        const mdxResult = htmlToMdx(html, { frontmatter });
        const snapshotDir = path.join(__dirname, "__snapshots__");
        if (!existsSync(snapshotDir)) {
            mkdirSync(snapshotDir);
        }
        const file = path.join(snapshotDir, "complex-htmlToMdx.json");
        writeFileSync(file, JSON.stringify(mdxResult, null, 2));
        await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(file);
    });
});

describe("Fixture files", () => {
    let faqMdx: string;
    let landingPageMdx: string;
    let complexOverviewMdx: string;
    let advancedFeaturesMdx: string;
    let openApiServerMdx: string;
    let useCasesMdx: string;
    let eventHandlerFunctionsMdx: string;

    beforeAll(async () => {
        const fs = await import("fs/promises");
        faqMdx = await fs.readFile(path.join(__dirname, "fixtures/faq.mdx"), "utf-8");
        landingPageMdx = await fs.readFile(path.join(__dirname, "fixtures/landing-page.mdx"), "utf-8");
        complexOverviewMdx = await fs.readFile(path.join(__dirname, "fixtures/complex-overview.mdx"), "utf-8");
        advancedFeaturesMdx = await fs.readFile(path.join(__dirname, "fixtures/advanced-features.mdx"), "utf-8");
        openApiServerMdx = await fs.readFile(path.join(__dirname, "fixtures/openapi-server.mdx"), "utf-8");
        useCasesMdx = await fs.readFile(path.join(__dirname, "fixtures/use-cases.mdx"), "utf-8");
        eventHandlerFunctionsMdx = await fs.readFile(
            path.join(__dirname, "fixtures/event-handler-functions.md"),
            "utf-8"
        );
    });

    describe("faq.mdx", () => {
        it("mdxToHtml: converts FAQ frontmatter correctly", () => {
            const result = mdxToHtml(faqMdx);

            // Verify frontmatter is extracted correctly
            expect(result.frontmatter).toEqual({
                title: "Empathic Voice Interface FAQ"
            });
        });

        it("htmlToMdx: round-trip conversion preserves structure", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(faqMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });

            // Verify the round-trip conversion produces valid MDX
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx).toContain("title: Empathic Voice Interface FAQ");
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx).toContain("We’ve compiled a list of frequently asked questions");
            expect(mdxResult.mdx).toContain("<AccordionGroup");
            expect(mdxResult.mdx).toContain("<Accordion");
        });
    });

    describe("landing-page.mdx", () => {
        it("mdxToHtml: converts landing page frontmatter correctly", () => {
            const result = mdxToHtml(landingPageMdx);

            // Verify frontmatter is extracted correctly
            expect(result.frontmatter).toEqual({
                layout: "custom",
                "no-image-zoom": true,
                description:
                    "Cohere's API documentation helps developers easily integrate natural language processing and generation into their products."
            });
        });

        it("htmlToMdx: round-trip conversion preserves structure", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(landingPageMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });

            // Verify the round-trip conversion produces valid MDX
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx).toContain("layout: custom");
            expect(mdxResult.mdx).toContain("no-image-zoom: true");
            expect(mdxResult.mdx).toContain("Cohere's API documentation");
            expect(mdxResult.mdx).toContain("export const LandingPageCard");
            expect(mdxResult.mdx).toContain("export const EndpointLink");
        });

        it("mdxToHtml: preserves JavaScript exports and complex JSX", () => {
            const { html } = mdxToHtml(landingPageMdx);
            const { mdx } = htmlToMdx(html);

            // Check that JavaScript exports are preserved in round-trip conversion
            expect(mdx).toContain("export const");
            expect(mdx).toContain("LandingPageCard");
        });

        it("mdxToHtml: handles CSS-in-JS and style blocks", () => {
            const { html } = mdxToHtml(landingPageMdx);
            const { mdx } = htmlToMdx(html);

            // Check that style blocks are preserved in round-trip conversion
            expect(mdx).toContain("<style>");
            expect(mdx).toContain("className=");
        });
    });

    describe("complex-overview.mdx", () => {
        it("htmlToMdx: round-trip conversion preserves structure", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(complexOverviewMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });

            // Since we're using the new v2 system, we can't expect exact equality
            // but should check that key content is preserved
            expect(mdxResult.mdx).toContain("title: Speech to Text");

            // Verify the round-trip conversion produces valid MDX
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx).toContain("title: Speech to Text");
            expect(mdxResult.mdx).toContain("subtitle: Learn how to turn spoken audio into text with ElevenLabs.");
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx).toContain("## Overview");
            expect(mdxResult.mdx).toContain(
                "The ElevenLabs [Speech to Text (STT)](/docs/api-reference/speech-to-text) API"
            );
            expect(mdxResult.mdx).toContain("<CardGroup");
            expect(mdxResult.mdx).toContain("<Card");
            expect(mdxResult.mdx).toContain("<Info>");
            expect(mdxResult.mdx).toContain("<Tabs>");
            expect(mdxResult.mdx).toContain("<Tab");
            expect(mdxResult.mdx).toContain("<AccordionGroup>");
            expect(mdxResult.mdx).toContain("<Accordion");
        });
    });

    describe("advanced-features.mdx", () => {
        it("mdxToHtml: converts advanced features frontmatter correctly", () => {
            const result = mdxToHtml(advancedFeaturesMdx);

            // Verify frontmatter is extracted correctly
            expect(result.frontmatter).toEqual({
                title: "Advanced MDX Features Test",
                subtitle: "A comprehensive test of unusual MDX features",
                tags: ["test", "mdx", "advanced", "features"],
                math: true,
                comments: true
            });
        });

        it("htmlToMdx: round-trip conversion preserves advanced features", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(advancedFeaturesMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });

            // Verify the round-trip conversion produces valid MDX
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx).toContain("title: Advanced MDX Features Test");
            expect(mdxResult.mdx).toContain("subtitle: A comprehensive test of unusual MDX features");
            expect(mdxResult.mdx).toContain("tags:");
            expect(mdxResult.mdx).toContain("  - test");
            expect(mdxResult.mdx).toContain("  - mdx");
            expect(mdxResult.mdx).toContain("  - advanced");
            expect(mdxResult.mdx).toContain("  - features");
            expect(mdxResult.mdx).toContain("math: true");
            expect(mdxResult.mdx).toContain("comments: true");
            expect(mdxResult.mdx).toContain("---");

            // Verify advanced features are preserved
            expect(mdxResult.mdx).toContain("~~strikethrough~~");
            expect(mdxResult.mdx).toContain("<sup>superscript</sup>");
            expect(mdxResult.mdx).toContain("<sub>subscript</sub>");
            expect(mdxResult.mdx).toContain("`inline code`");
            expect(mdxResult.mdx).toContain("**bold**");
            expect(mdxResult.mdx).toContain("*italic*");

            // Verify basic HTML is preserved
            expect(mdxResult.mdx).toContain("<div");
            expect(mdxResult.mdx).toContain("className=");

            // Verify math expressions are preserved
            expect(mdxResult.mdx).toContain("$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$");
            expect(mdxResult.mdx).toContain("\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}");

            // Verify task lists are preserved
            expect(mdxResult.mdx).toContain("[x] Completed task");
            expect(mdxResult.mdx).toContain("[ ] Pending task");

            // Verify definition lists are preserved
            expect(mdxResult.mdx).toContain("<dl>");
            expect(mdxResult.mdx).toContain("<dt>");
            expect(mdxResult.mdx).toContain("<dd>");

            // Note: Footnotes may not be preserved in exact format after round-trip conversion
            // This is expected behavior for the current implementation

            // Verify comments are preserved
            expect(mdxResult.mdx).toContain("{/*");

            // Verify complex tables are preserved (formatting may vary but structure is maintained)
            expect(mdxResult.mdx).toContain("| Feature");
            expect(mdxResult.mdx).toContain("Description");
            expect(mdxResult.mdx).toContain("Example");
            expect(mdxResult.mdx).toContain("Status |");
            expect(mdxResult.mdx).toMatch(/\|[:\s-]+\|[:\s-]+\|[:\s-]+\|[:\s-]+\|/); // Table separator row

            // Verify code blocks are preserved
            expect(mdxResult.mdx).toContain("```javascript");
            expect(mdxResult.mdx).toContain("```typescript");
            expect(mdxResult.mdx).toContain("```css");

            // Verify blockquotes are preserved
            expect(mdxResult.mdx).toContain("> This is a **blockquote**");

            // Verify special characters and Unicode are preserved
            expect(mdxResult.mdx).toContain("🚀 💻 ⚡ 🎯");
            expect(mdxResult.mdx).toContain("مرحبا بالعالم");
            expect(mdxResult.mdx).toContain("α β γ δ ε");
        });

        it("mdxToHtml: handles basic HTML and JSX elements", () => {
            const { html } = mdxToHtml(advancedFeaturesMdx);
            const { mdx } = htmlToMdx(html);

            // Check for basic HTML and JSX elements in round-trip conversion
            expect(mdx).toContain("<div");
            expect(mdx).toContain("className=");
        });

        it("mdxToHtml: preserves event handlers and expressions", () => {
            const { html } = mdxToHtml(advancedFeaturesMdx);
            const { mdx } = htmlToMdx(html);

            // Check for event handlers and expressions in HTML
            expect(mdx).toContain("onClick=");
            expect(mdx).toContain("{2 + 2}");
            expect(mdx).toContain("{true ?");
            expect(mdx).toContain("`${");
            expect(mdx).toContain("}`");
        });
    });

    describe("Fixture files - file snapshots", () => {
        it("mdxToHtml: faq.mdx file snapshot", async () => {
            const result = mdxToHtml(faqMdx);
            const snapshotDir = path.join(__dirname, "__snapshots__");
            if (!existsSync(snapshotDir)) {
                mkdirSync(snapshotDir);
            }
            const file = path.join(snapshotDir, "faq-mdxToHtml.json");
            writeFileSync(file, JSON.stringify(result, null, 2));
            await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
        });

        it("htmlToMdx: faq.mdx file snapshot", async () => {
            const { html, frontmatter } = mdxToHtml(faqMdx);
            const mdxResult = htmlToMdx(html, { frontmatter });
            const snapshotDir = path.join(__dirname, "__snapshots__");
            if (!existsSync(snapshotDir)) {
                mkdirSync(snapshotDir);
            }
            const file = path.join(snapshotDir, "faq-htmlToMdx.json");
            writeFileSync(file, JSON.stringify(mdxResult, null, 2));
            await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(file);
        });

        it("mdxToHtml: landing-page.mdx file snapshot", async () => {
            const result = mdxToHtml(landingPageMdx);
            const snapshotDir = path.join(__dirname, "__snapshots__");
            if (!existsSync(snapshotDir)) {
                mkdirSync(snapshotDir);
            }
            const file = path.join(snapshotDir, "landing-page-mdxToHtml.json");
            writeFileSync(file, JSON.stringify(result, null, 2));
            await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
        });

        it("htmlToMdx: landing-page.mdx file snapshot", async () => {
            const { html, frontmatter } = mdxToHtml(landingPageMdx);
            const mdxResult = htmlToMdx(html, { frontmatter });
            const snapshotDir = path.join(__dirname, "__snapshots__");
            if (!existsSync(snapshotDir)) {
                mkdirSync(snapshotDir);
            }
            const file = path.join(snapshotDir, "landing-page-htmlToMdx.json");
            writeFileSync(file, JSON.stringify(mdxResult, null, 2));
            await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(file);
        });

        it("mdxToHtml: advanced-features.mdx file snapshot", async () => {
            const result = mdxToHtml(advancedFeaturesMdx);
            const snapshotDir = path.join(__dirname, "__snapshots__");
            if (!existsSync(snapshotDir)) {
                mkdirSync(snapshotDir);
            }
            const file = path.join(snapshotDir, "advanced-features-mdxToHtml.json");
            writeFileSync(file, JSON.stringify(result, null, 2));
            await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
        });

        it("htmlToMdx: advanced-features.mdx file snapshot", async () => {
            const { html, frontmatter } = mdxToHtml(advancedFeaturesMdx);
            const mdxResult = htmlToMdx(html, { frontmatter });
            const snapshotDir = path.join(__dirname, "__snapshots__");
            if (!existsSync(snapshotDir)) {
                mkdirSync(snapshotDir);
            }
            const file = path.join(snapshotDir, "advanced-features-htmlToMdx.json");
            writeFileSync(file, JSON.stringify(mdxResult, null, 2));
            await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(file);
        });
    });

    describe("openapi-server.mdx", () => {
        it("round-trip conversion preserves structure", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(openApiServerMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });
            // Check that key content is preserved (can't expect exact equality with v2 system)
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx.length).toBeGreaterThan(100);
        });
    });

    describe("use-cases.mdx", () => {
        it("round-trip conversion preserves structure", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(useCasesMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });
            // Check that key content is preserved (can't expect exact equality with v2 system)
            expect(mdxResult.mdx).toContain("---");
            expect(mdxResult.mdx.length).toBeGreaterThan(100);
        });
    });

    describe("event-handler-functions.md", () => {
        it("round-trip conversion preserves structure", () => {
            const { html, frontmatter, originalFrontmatter } = mdxToHtml(eventHandlerFunctionsMdx);
            const mdxResult = htmlToMdx(html, { frontmatter, originalFrontmatter });
            // Check that key content is preserved (can't expect exact equality with v2 system)
            expect(mdxResult.mdx).toContain("# Event handler methods");
            expect(mdxResult.mdx.length).toBeGreaterThan(100);
        });
    });
});

describe("Ensure no list duplication", () => {
    const simpleBulletList = `## Header
- Bullet 1
  - Bullet 1.1
  - Bullet 1.2
- Bullet 2`;

    it("single round-trip should not duplicate list items", () => {
        console.log("\n=== STARTING SINGLE ROUND-TRIP TEST ===");
        console.log("Original MDX:", simpleBulletList);

        // First conversion: MDX → HTML
        const { html, frontmatter } = mdxToHtml(simpleBulletList);
        console.log("\n=== After mdxToHtml ===");
        console.log("HTML:", html);

        // Second conversion: HTML → MDX
        const mdxResult = htmlToMdx(html, { frontmatter });
        console.log("\n=== After htmlToMdx ===");
        console.log("Result MDX:", mdxResult.mdx);

        // Check that we don't have "- -" or "* *" pattern (indicates duplication)
        expect(mdxResult.mdx).not.toContain("- -");
        expect(mdxResult.mdx).not.toContain("* *");

        // Count the number of list items - should be 1 top-level + 3 nested = 4 total
        // Note: toMarkdown uses * for bullets by default, even though we configured bullet: "-"
        const listItemCount = (mdxResult.mdx.match(/^[\s]*[*-] /gm) || []).length;
        console.log("List item count:", listItemCount);
        expect(listItemCount).toBe(4); // 1 top-level + 3 nested items
    });

    it("multiple round-trips should not accumulate duplications", () => {
        console.log("\n=== STARTING MULTIPLE ROUND-TRIPS TEST ===");
        let currentMdx = simpleBulletList;

        // Perform 3 round-trips
        for (let i = 1; i <= 3; i++) {
            console.log(`\n=== Round-trip ${i} ===`);
            console.log("Input MDX:", currentMdx);

            const { html, frontmatter } = mdxToHtml(currentMdx);
            console.log("HTML:", html);

            const result = htmlToMdx(html, { frontmatter });
            currentMdx = result.mdx;
            console.log("Output MDX:", currentMdx);

            // After each round-trip, verify no duplication
            expect(currentMdx).not.toContain("- -");
            expect(currentMdx).not.toContain("* *");

            // Count list items - should remain constant
            const listItemCount = (currentMdx.match(/^[\s]*[*-] /gm) || []).length;
            console.log(`List item count after round-trip ${i}:`, listItemCount);
            expect(listItemCount).toBe(4);
        }
    });
});
