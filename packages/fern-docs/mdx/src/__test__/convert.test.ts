import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

import { htmlToMdx, mdxToHtml } from "../convert";

describe("mdxToHtml and htmlToMdx", () => {
  const simpleMdx = `# Hello World\n\nThis is a test.`;
  const mdxWithFrontmatter = `---\ntitle: Test Title\ndescription: Test Description\n---\n\n# Heading\n\nSome content.`;
  const mdxWithCustom = `# Hello <Custom value="foo" />`;

  it("mdxToHtml: simple mdx", () => {
    const result = mdxToHtml(simpleMdx);
    expect(result.html).toMatchInlineSnapshot(`
      "<h1 data-hash="faa57de96fd4aed481986db6a4e13666b7ff4381313a0e9679c251b0fbad6dd6">Hello World</h1>
      <p data-hash="a8a2f6ebe286697c527eb35a58b5539532e9b3ae3b64d4eb0a46fb657b41562c">This is a test.</p>"
    `);
    expect(result.frontmatter).toMatchInlineSnapshot(`{}`);
    expect(result.originalElements).toMatchInlineSnapshot(`
      {
        "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e": {
          "content": "Hello World",
          "name": undefined,
          "type": "text",
        },
        "a8a2f6ebe286697c527eb35a58b5539532e9b3ae3b64d4eb0a46fb657b41562c": {
          "content": "This is a test.",
          "name": undefined,
          "type": "text",
        },
        "faa57de96fd4aed481986db6a4e13666b7ff4381313a0e9679c251b0fbad6dd6": {
          "content": "# Hello World",
          "name": undefined,
          "type": "heading",
        },
      }
    `);
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
    expect(result.originalElements).toMatchInlineSnapshot(`
      {
        "b046f6fd47ffce0c3b0ae0df78eaf08cf71d75452c69c456a465da1834fa7f3e": {
          "content": "Some content.",
          "name": undefined,
          "type": "text",
        },
        "b34f17f02ecf0307437429f667421d119aaf1bf819694236efe15c538850445c": {
          "content": "Heading",
          "name": undefined,
          "type": "text",
        },
        "fab9d5d23bffb992592cd2cae9ed8b258e676c6d6bbb28c9b12b5cb99f7a5901": {
          "content": "# Heading",
          "name": undefined,
          "type": "heading",
        },
      }
    `);
  });

  it("mdxToHtml: with custom element", () => {
    const result = mdxToHtml(mdxWithCustom);
    expect(result.html).toMatchInlineSnapshot(
      `"<h1 data-hash="f214b3907789c8022f2fba121de073a232bb739ab1b2af0fb069427e7c45d9db">Hello <custom-element data-hash="fdb67202a066a8317f3ce3ab7ae5f68057300caf4c1fccd11ee1df3406b08a79" data-type="mdxJsxTextElement" data-name="Custom">&#x3C;Custom value="foo" /></custom-element></h1>"`
    );
    expect(result.frontmatter).toMatchInlineSnapshot(`{}`);
    expect(result.originalElements).toMatchInlineSnapshot(`
      {
        "2ec5a3f0c2fc3e6dcee0f6f3a5735a6c69d2056579a5452095b75802094043a8": {
          "content": "Hello ",
          "name": undefined,
          "type": "text",
        },
        "f214b3907789c8022f2fba121de073a232bb739ab1b2af0fb069427e7c45d9db": {
          "content": "# Hello <Custom value="foo" />",
          "name": undefined,
          "type": "heading",
        },
        "fdb67202a066a8317f3ce3ab7ae5f68057300caf4c1fccd11ee1df3406b08a79": {
          "content": "<Custom value="foo" />",
          "name": "Custom",
          "type": "mdxJsxTextElement",
        },
      }
    `);
  });

  it("htmlToMdx: round-trip simple", () => {
    const { html, frontmatter, originalElements } = mdxToHtml(simpleMdx);
    const mdxResult = htmlToMdx(html, frontmatter, originalElements);
    expect(mdxResult.mdx).toMatchInlineSnapshot(`
      "# Hello World

      This is a test.
      "
    `);
  });

  it("htmlToMdx: round-trip with frontmatter", () => {
    const { html, frontmatter, originalElements } =
      mdxToHtml(mdxWithFrontmatter);
    const mdxResult = htmlToMdx(html, frontmatter, originalElements);
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
    const { html, frontmatter, originalElements } = mdxToHtml(mdxWithCustom);
    const mdxResult = htmlToMdx(html, frontmatter, originalElements);
    expect(mdxResult.mdx).toMatchInlineSnapshot(`
      "# Hello <Custom value="foo" />
      "
    `);
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
    const { html, frontmatter, originalElements } = mdxToHtml(complexMdx);
    const mdxResult = htmlToMdx(html, frontmatter, originalElements);
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

      // Verify originalElements contains the expected structure
      expect(Object.keys(result.originalElements).length).toBeGreaterThan(0);

      // Check for specific elements we expect
      const elementValues = Object.values(result.originalElements);
      const hasAccordionGroup = elementValues.some((el) =>
        el.content?.includes("AccordionGroup")
      );
      expect(hasAccordionGroup).toBe(true);
    });

    it("htmlToMdx: round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(faqMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );

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

      // Verify originalElements contains the expected structure
      expect(Object.keys(result.originalElements).length).toBeGreaterThan(0);
    });

    it("htmlToMdx: round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(landingPageMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );

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

      // Check that JavaScript exports are preserved
      const exportElements = Object.values(result.originalElements).filter(
        (el) => el.content?.includes("export const")
      );
      expect(exportElements.length).toBeGreaterThan(0);

      // Check for specific exports
      const landingPageCardExport = exportElements.find((el) =>
        el.content?.includes("LandingPageCard")
      );
      expect(landingPageCardExport).toBeDefined();
    });

    it("mdxToHtml: handles CSS-in-JS and style blocks", () => {
      const result = mdxToHtml(landingPageMdx);

      // Check that style blocks are preserved
      const styleElements = Object.values(result.originalElements).filter(
        (el) => el.content?.includes("<style>")
      );
      expect(styleElements.length).toBeGreaterThan(0);

      // Check that CSS-in-JS content is preserved
      const cssInJsElements = Object.values(result.originalElements).filter(
        (el) => el.content?.includes("className=")
      );
      expect(cssInJsElements.length).toBeGreaterThan(0);
    });
  });

  describe("complex-overview.mdx", () => {
    it("htmlToMdx: round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(complexOverviewMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );

      expect(mdxResult.mdx).toBe(complexOverviewMdx);

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

      // Verify originalElements contains the expected structure
      expect(Object.keys(result.originalElements).length).toBeGreaterThan(0);

      // Check for specific advanced features
      const elementValues = Object.values(result.originalElements);

      // Check for strikethrough elements
      const hasStrikethrough = elementValues.some((el) =>
        el.content?.includes("~~strikethrough~~")
      );
      expect(hasStrikethrough).toBe(true);

      // Check for superscript/subscript elements
      const hasSuperscript = elementValues.some((el) =>
        el.content?.includes("<sup>")
      );
      expect(hasSuperscript).toBe(true);

      const hasSubscript = elementValues.some((el) =>
        el.content?.includes("<sub>")
      );
      expect(hasSubscript).toBe(true);

      // Check for math expressions
      const hasMath = elementValues.some((el) =>
        el.content?.includes("$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$")
      );
      expect(hasMath).toBe(true);

      // Check for basic HTML elements
      const hasDivElements = elementValues.some((el) =>
        el.content?.includes("<div")
      );
      expect(hasDivElements).toBe(true);

      // Check for task lists
      const hasTaskList = elementValues.some(
        (el) => el.content?.includes("[x]") || el.content?.includes("[ ]")
      );
      expect(hasTaskList).toBe(true);

      // Check for definition lists
      const hasDefinitionList = elementValues.some(
        (el) =>
          el.content?.includes("<dl>") ||
          el.content?.includes("<dt>") ||
          el.content?.includes("<dd>")
      );
      expect(hasDefinitionList).toBe(true);

      // Check for footnotes
      const hasFootnotes = elementValues.some(
        (el) => el.content?.includes("[^1]") || el.content?.includes("[^2]")
      );
      expect(hasFootnotes).toBe(true);

      // Check for comments
      const hasComments = elementValues.some((el) =>
        el.content?.includes("{/*")
      );
      expect(hasComments).toBe(true);
    });

    it("htmlToMdx: round-trip conversion preserves advanced features", () => {
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(advancedFeaturesMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );

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

      // Check for basic HTML elements
      const htmlElements = Object.values(result.originalElements).filter(
        (el) => el.content?.includes("<div") || el.content?.includes("<span")
      );
      expect(htmlElements.length).toBeGreaterThan(0);

      // Check for JSX attributes
      const jsxElements = Object.values(result.originalElements).filter(
        (el) =>
          el.content?.includes("className=") || el.content?.includes("onClick=")
      );
      expect(jsxElements.length).toBeGreaterThan(0);

      // Check for spread operators
      const spreadElements = Object.values(result.originalElements).filter(
        (el) => el.content?.includes("...{")
      );
      expect(spreadElements.length).toBeGreaterThan(0);
    });

    it("mdxToHtml: preserves event handlers and expressions", () => {
      const result = mdxToHtml(advancedFeaturesMdx);

      // Check for event handlers
      const eventHandlerElements = Object.values(
        result.originalElements
      ).filter((el) => el.content?.includes("onClick="));
      expect(eventHandlerElements.length).toBeGreaterThan(0);

      // Check for simple expressions
      const expressionElements = Object.values(result.originalElements).filter(
        (el) =>
          el.content?.includes("{2 + 2}") || el.content?.includes("{true ?")
      );
      expect(expressionElements.length).toBeGreaterThan(0);

      // Check for template literals
      const templateElements = Object.values(result.originalElements).filter(
        (el) => el.content?.includes("`${") || el.content?.includes("}`")
      );
      expect(templateElements.length).toBeGreaterThan(0);
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
      const { html, frontmatter, originalElements } = mdxToHtml(faqMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalElements);
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
      const { html, frontmatter, originalElements } = mdxToHtml(landingPageMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalElements);
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
      const { html, frontmatter, originalElements } =
        mdxToHtml(advancedFeaturesMdx);
      const mdxResult = htmlToMdx(html, frontmatter, originalElements);
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
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(openApiServerMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );
      expect(mdxResult.mdx).toBe(openApiServerMdx);
    });
  });

  describe("use-cases.mdx", () => {
    it("round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(useCasesMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );
      expect(mdxResult.mdx).toBe(useCasesMdx);
    });
  });

  describe("event-handler-functions.md", () => {
    it("round-trip conversion preserves structure", () => {
      const { html, frontmatter, originalElements, originalFrontmatter } =
        mdxToHtml(eventHandlerFunctionsMdx);
      const changedNodes = Object.fromEntries(
        Object.entries(originalElements).map(([key, _]) => [key, false])
      );
      const mdxResult = htmlToMdx(
        html,
        frontmatter,
        originalElements,
        originalFrontmatter,
        changedNodes
      );
      expect(mdxResult.mdx).toBe(eventHandlerFunctionsMdx);
    });
  });
});
