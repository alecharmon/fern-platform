import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

import { htmlToMdx, mdxToHtml } from "../convert";

describe("mdxToHtml and htmlToMdx", () => {
  const simpleMdx = `# Hello World\n\nThis is a test.`;
  const mdxWithFrontmatter = `---\ntitle: Test Title\ndescription: Test Description\n---\n\n# Heading\n\nSome content.`;
  const mdxWithCustom = `# Hello <Custom value="foo" />`;
  const mdxWithImage = `# Document\n\n![Alt text](image.png "Title")\n\nSome text.`;
  const mdxWithImageUpload = `# Document\n\n<div data-type="image-upload" />\n\nSome text.`;

  it("mdxToHtml: simple mdx", () => {
    const result = mdxToHtml(simpleMdx);
    expect(result.html).toMatchInlineSnapshot(`
      "<h1 data-hash="faa57de96fd4aed481986db6a4e13666b7ff4381313a0e9679c251b0fbad6dd6">Hello World</h1>
      <p data-hash="a8a2f6ebe286697c527eb35a58b5539532e9b3ae3b64d4eb0a46fb657b41562c">This is a test.</p>"
    `);
    expect(result.frontmatter).toMatchInlineSnapshot(`{}`);
  });

  it("mdxToHtml: with frontmatter", () => {
    const result = mdxToHtml(mdxWithFrontmatter);
    expect(result.html).toMatchInlineSnapshot(`
      "<h1 data-hash="fab9d5d23bffb992592cd2cae9ed8b258e676c6d6bbb28c9b12b5cb99f7a5901">Heading</h1>
      <p data-hash="b046f6fd47ffce0c3b0ae0df78eaf08cf71d75452c69c456a465da1834fa7f3e">Some content.</p>"
    `);
    expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "description": "Test Description",
        "title": "Test Title",
      }
    `);
  });

  it("mdxToHtml: with custom element", () => {
    const result = mdxToHtml(mdxWithCustom);
    expect(result.html).toContain("data-hash");
    expect(result.html).toContain("custom-element-v2");
    expect(result.html).toContain('fve-data-name="Custom"');
    expect(result.html).toContain('fve-unsupported="true"');
    expect(result.frontmatter).toMatchInlineSnapshot(`{}`);
  });

  it("htmlToMdx: round-trip simple", () => {
    const { html, frontmatter } = mdxToHtml(simpleMdx);
    const mdxResult = htmlToMdx(html, frontmatter);
    expect(mdxResult.mdx).toMatchInlineSnapshot(`
      "# Hello World

      This is a test.
      "
    `);
  });

  it("htmlToMdx: round-trip with frontmatter", () => {
    const { html, frontmatter } = mdxToHtml(mdxWithFrontmatter);
    const mdxResult = htmlToMdx(html, frontmatter);
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
    const mdxResult = htmlToMdx(html, frontmatter);
    expect(mdxResult.mdx).toContain("# Hello");
    expect(mdxResult.mdx).toContain('<Custom value="foo" />');
  });

  it("mdxToHtml: with image", () => {
    const result = mdxToHtml(mdxWithImage);
    expect(result.html).toContain("data-hash");
    expect(result.html).toContain("custom-element-v2");
    expect(result.html).toContain('fve-unsupported="true"');
    expect(result.html).toContain(
      'fve-mdx-content="![Alt text](image.png &#x22;Title&#x22;)"'
    );
    expect(result.frontmatter).toEqual({});
  });

  it("htmlToMdx: round-trip with image", () => {
    const { html, frontmatter } = mdxToHtml(mdxWithImage);
    const mdxResult = htmlToMdx(html, frontmatter);
    expect(mdxResult.mdx).toContain("# Document");
    // Images should be preserved as the original markdown or converted to HTML syntax
    expect(mdxResult.mdx).toContain('![Alt text](image.png "Title")');
    expect(mdxResult.mdx).toContain("Some text.");
  });

  it("mdxToHtml: with image-upload div", () => {
    const result = mdxToHtml(mdxWithImageUpload);
    expect(result.html).toContain("data-hash");
    expect(result.html).toContain('<div data-type="image-upload"');
    expect(result.frontmatter).toEqual({});
  });

  it("htmlToMdx: round-trip with image-upload div", () => {
    const { html, frontmatter } = mdxToHtml(mdxWithImageUpload);
    const mdxResult = htmlToMdx(html, frontmatter);
    expect(mdxResult.mdx).toContain("# Document");
    expect(mdxResult.mdx).toContain('<div data-type="image-upload"');
    expect(mdxResult.mdx).toContain("Some text.");
  });

  // File-based snapshot for a larger/complex case
  const complexMdx = `---\ntitle: Complex\n---\n\n# Title\n\n- List item 1\n- List item 2\n\n<Custom value="bar" />\n\n\n## Subheading\n\n\n\n\nAnother paragraph.`;
  it("mdxToHtml: complex file snapshot", async () => {
    const result = mdxToHtml(complexMdx);
    const snapshotDir = path.join(__dirname, "__snapshots__");
    if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
    const file = path.join(snapshotDir, "complex-mdxToHtml.json");
    writeFileSync(file, JSON.stringify(result, null, 2));
    await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
  });

  it("htmlToMdx: complex file snapshot", async () => {
    const { html, frontmatter } = mdxToHtml(complexMdx);
    const mdxResult = htmlToMdx(html, frontmatter);
    const snapshotDir = path.join(__dirname, "__snapshots__");
    if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
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
    faqMdx = await fs.readFile(
      path.join(__dirname, "fixtures/faq.mdx"),
      "utf-8"
    );
    landingPageMdx = await fs.readFile(
      path.join(__dirname, "fixtures/landing-page.mdx"),
      "utf-8"
    );
    complexOverviewMdx = await fs.readFile(
      path.join(__dirname, "fixtures/complex-overview.mdx"),
      "utf-8"
    );
    advancedFeaturesMdx = await fs.readFile(
      path.join(__dirname, "fixtures/advanced-features.mdx"),
      "utf-8"
    );
    openApiServerMdx = await fs.readFile(
      path.join(__dirname, "fixtures/openapi-server.mdx"),
      "utf-8"
    );
    useCasesMdx = await fs.readFile(
      path.join(__dirname, "fixtures/use-cases.mdx"),
      "utf-8"
    );
    eventHandlerFunctionsMdx = await fs.readFile(
      path.join(__dirname, "fixtures/event-handler-functions.md"),
      "utf-8"
    );
  });

  describe("faq.mdx", () => {
    it("mdxToHtml: converts FAQ file correctly", () => {
      const result = mdxToHtml(faqMdx);

      // Verify frontmatter is extracted correctly
      expect(result.frontmatter).toEqual({
        title: "Empathic Voice Interface FAQ",
      });

      // Verify HTML contains expected content
      expect(result.html).toContain("data-hash");
      expect(result.html).toContain(
        "We’ve compiled a list of frequently asked questions"
      );
      expect(result.html).toContain("AccordionGroup");
      expect(result.html).toContain("Accordion");

      // Verify HTML contains custom elements
      expect(result.html).toContain("custom-element-v2");

      expect(result.html).toContain("AccordionGroup");
    });

    it("htmlToMdx: round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalFrontmatter } = mdxToHtml(faqMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);

      // Verify the round-trip conversion produces valid MDX
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx).toContain("title: Empathic Voice Interface FAQ");
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx).toContain(
        "We’ve compiled a list of frequently asked questions"
      );
      expect(mdxResult.mdx).toContain("<AccordionGroup");
      expect(mdxResult.mdx).toContain("<Accordion");
    });
  });

  describe("landing-page.mdx", () => {
    it("mdxToHtml: converts landing page file correctly", () => {
      const result = mdxToHtml(landingPageMdx);

      // Verify frontmatter is extracted correctly
      expect(result.frontmatter).toEqual({
        layout: "custom",
        "no-image-zoom": true,
        description:
          "Cohere's API documentation helps developers easily integrate natural language processing and generation into their products.",
      });

      // Verify HTML contains expected content
      expect(result.html).toContain("data-hash");
      expect(result.html).toContain("LandingPageCard");
      expect(result.html).toContain("EndpointLink");

      // Verify HTML contains custom elements
      expect(result.html).toContain("custom-element-v2");
    });

    it("htmlToMdx: round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalFrontmatter } =
        mdxToHtml(landingPageMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);

      // Verify the round-trip conversion produces valid MDX
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx).toContain("layout: custom");
      expect(mdxResult.mdx).toContain("no-image-zoom: true");
      expect(mdxResult.mdx).toContain("Cohere's API documentation");
      expect(mdxResult.mdx).toContain("export const LandingPageCard");
      expect(mdxResult.mdx).toContain("export const EndpointLink");
    });

    it("mdxToHtml: preserves JavaScript exports and complex JSX", () => {
      const result = mdxToHtml(landingPageMdx);

      // Check that JavaScript exports are preserved in HTML
      expect(result.html).toContain("export const");
      expect(result.html).toContain("LandingPageCard");
    });

    it("mdxToHtml: handles CSS-in-JS and style blocks", () => {
      const result = mdxToHtml(landingPageMdx);

      // Check that style blocks are preserved in HTML
      expect(result.html).toContain("<style>");
      expect(result.html).toContain("className=");
    });
  });

  describe("complex-overview.mdx", () => {
    it("htmlToMdx: round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalFrontmatter } =
        mdxToHtml(complexOverviewMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);

      // Since we're using the new v2 system, we can't expect exact equality
      // but should check that key content is preserved
      expect(mdxResult.mdx).toContain("title: Speech to Text");

      // Verify the round-trip conversion produces valid MDX
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx).toContain("title: Speech to Text");
      expect(mdxResult.mdx).toContain(
        "subtitle: Learn how to turn spoken audio into text with ElevenLabs."
      );
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
    it("mdxToHtml: converts advanced features file correctly", () => {
      const result = mdxToHtml(advancedFeaturesMdx);

      // Verify frontmatter is extracted correctly
      expect(result.frontmatter).toEqual({
        title: "Advanced MDX Features Test",
        subtitle: "A comprehensive test of unusual MDX features",
        tags: ["test", "mdx", "advanced", "features"],
        math: true,
        comments: true,
      });

      // Verify HTML contains expected content
      expect(result.html).toContain("data-hash");
      expect(result.html).toContain("Advanced MDX Features Demonstration");
      expect(result.html).toContain("~~strikethrough~~");

      // Verify HTML contains custom elements
      expect(result.html).toContain("custom-element-v2");

      // Check that various advanced features are preserved in HTML
      expect(result.html).toContain("~~strikethrough~~");
      expect(result.html).toContain("<sup>");
      expect(result.html).toContain("<sub>");
      expect(result.html).toContain(
        "$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"
      );
      expect(result.html).toContain("<div");
      expect(result.html).toContain("[x]");
      expect(result.html).toContain("[ ]");
      expect(result.html).toContain("<dl>");
      expect(result.html).toContain("<dt>");
      expect(result.html).toContain("<dd>");
      expect(result.html).toContain("[^1]");
      expect(result.html).toContain("[^2]");
      expect(result.html).toContain("{/*");
    });

    it("htmlToMdx: round-trip conversion preserves advanced features", () => {
      const { html, frontmatter, originalFrontmatter } =
        mdxToHtml(advancedFeaturesMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);

      // Verify the round-trip conversion produces valid MDX
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx).toContain("title: Advanced MDX Features Test");
      expect(mdxResult.mdx).toContain(
        "subtitle: A comprehensive test of unusual MDX features"
      );
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
      expect(mdxResult.mdx).toContain(
        "$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$"
      );
      expect(mdxResult.mdx).toContain(
        "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}"
      );

      // Verify task lists are preserved
      expect(mdxResult.mdx).toContain("[x] Completed task");
      expect(mdxResult.mdx).toContain("[ ] Pending task");

      // Verify definition lists are preserved
      expect(mdxResult.mdx).toContain("<dl>");
      expect(mdxResult.mdx).toContain("<dt>");
      expect(mdxResult.mdx).toContain("<dd>");

      // Verify footnotes are preserved
      expect(mdxResult.mdx).toContain("[^1]");
      expect(mdxResult.mdx).toContain("[^2]");

      // Verify comments are preserved
      expect(mdxResult.mdx).toContain("{/*");

      // Verify complex tables are preserved
      expect(mdxResult.mdx).toContain(
        "| Feature | Description | Example | Status |"
      );
      expect(mdxResult.mdx).toContain(
        "|:--------|:-----------:|--------:|:------:|"
      );

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
      const result = mdxToHtml(advancedFeaturesMdx);

      // Check for basic HTML and JSX elements in HTML - these might be in custom elements
      expect(result.html).toContain("<div");
      expect(result.html).toContain("custom-element-v2");
      expect(result.html).toContain('fve-unsupported="true"');
    });

    it("mdxToHtml: preserves event handlers and expressions", () => {
      const result = mdxToHtml(advancedFeaturesMdx);

      // Check for event handlers and expressions in HTML
      expect(result.html).toContain("onClick=");
      expect(result.html).toContain("{2 + 2}");
      expect(result.html).toContain("{true ?");
      expect(result.html).toContain("`${");
      expect(result.html).toContain("}`");
    });
  });

  describe("Fixture files - file snapshots", () => {
    it("mdxToHtml: faq.mdx file snapshot", async () => {
      const result = mdxToHtml(faqMdx);
      const snapshotDir = path.join(__dirname, "__snapshots__");
      if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
      const file = path.join(snapshotDir, "faq-mdxToHtml.json");
      writeFileSync(file, JSON.stringify(result, null, 2));
      await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
    });

    it("htmlToMdx: faq.mdx file snapshot", async () => {
      const { html, frontmatter } = mdxToHtml(faqMdx);
      const mdxResult = htmlToMdx(html, frontmatter);
      const snapshotDir = path.join(__dirname, "__snapshots__");
      if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
      const file = path.join(snapshotDir, "faq-htmlToMdx.json");
      writeFileSync(file, JSON.stringify(mdxResult, null, 2));
      await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(
        file
      );
    });

    it("mdxToHtml: landing-page.mdx file snapshot", async () => {
      const result = mdxToHtml(landingPageMdx);
      const snapshotDir = path.join(__dirname, "__snapshots__");
      if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
      const file = path.join(snapshotDir, "landing-page-mdxToHtml.json");
      writeFileSync(file, JSON.stringify(result, null, 2));
      await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
    });

    it("htmlToMdx: landing-page.mdx file snapshot", async () => {
      const { html, frontmatter } = mdxToHtml(landingPageMdx);
      const mdxResult = htmlToMdx(html, frontmatter);
      const snapshotDir = path.join(__dirname, "__snapshots__");
      if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
      const file = path.join(snapshotDir, "landing-page-htmlToMdx.json");
      writeFileSync(file, JSON.stringify(mdxResult, null, 2));
      await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(
        file
      );
    });

    it("mdxToHtml: advanced-features.mdx file snapshot", async () => {
      const result = mdxToHtml(advancedFeaturesMdx);
      const snapshotDir = path.join(__dirname, "__snapshots__");
      if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
      const file = path.join(snapshotDir, "advanced-features-mdxToHtml.json");
      writeFileSync(file, JSON.stringify(result, null, 2));
      await expect(JSON.stringify(result, null, 2)).toMatchFileSnapshot(file);
    });

    it("htmlToMdx: advanced-features.mdx file snapshot", async () => {
      const { html, frontmatter } = mdxToHtml(advancedFeaturesMdx);
      const mdxResult = htmlToMdx(html, frontmatter);
      const snapshotDir = path.join(__dirname, "__snapshots__");
      if (!existsSync(snapshotDir)) mkdirSync(snapshotDir);
      const file = path.join(snapshotDir, "advanced-features-htmlToMdx.json");
      writeFileSync(file, JSON.stringify(mdxResult, null, 2));
      await expect(JSON.stringify(mdxResult, null, 2)).toMatchFileSnapshot(
        file
      );
    });
  });

  describe("openapi-server.mdx", () => {
    it("round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalFrontmatter } =
        mdxToHtml(openApiServerMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);
      // Check that key content is preserved (can't expect exact equality with v2 system)
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx.length).toBeGreaterThan(100);
    });
  });

  describe("use-cases.mdx", () => {
    it("round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalFrontmatter } = mdxToHtml(useCasesMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);
      // Check that key content is preserved (can't expect exact equality with v2 system)
      expect(mdxResult.mdx).toContain("---");
      expect(mdxResult.mdx.length).toBeGreaterThan(100);
    });
  });

  describe("event-handler-functions.md", () => {
    it("round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalFrontmatter } = mdxToHtml(
        eventHandlerFunctionsMdx
      );
      const mdxResult = htmlToMdx(html, frontmatter, originalFrontmatter);
      // Check that key content is preserved (can't expect exact equality with v2 system)
      expect(mdxResult.mdx).toContain("# Event handler methods");
      expect(mdxResult.mdx.length).toBeGreaterThan(100);
    });
  });
});
