import { hastToMarkdown, toTree } from "@fern-docs/mdx";
import { rehypeSlug } from "@fern-docs/mdx/plugins";

import { rehypeSteps } from "./rehype-steps";

const handleSteps = (rehypeSteps as any)();
const handleSlug = (rehypeSlug as any)({
    additionalJsxElements: ["Step"]
});

describe("rehype-steps", () => {
    it("should migrate steps to step groups", () => {
        const tree = toTree(`
      <Steps>
        <Step>
            Step 1
        </Step>
        <Step>
            Step 2
        </Step>
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup>
        <Step id="step">
          Step 1
        </Step>

        <Step id="step-1">
          Step 2
        </Step>
      </StepGroup>
      "
    `);
    });

    it("Should migrate heading-based steps to step groups", () => {
        const tree = toTree(`
      <Steps>
        ### Step 1
        
        This is some content within step 1

        #### With a sub heading

        and content within subheading

        ### Step 2

        This is some content within step 2
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup tocDepth=\"3\">
        <Step id="step-1" title="Step 1">
          This is some content within step 1

          #### With a sub heading

          and content within subheading
        </Step>

        <Step id="step-2" title="Step 2">
          This is some content within step 2
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should handle h1 and h2 headings gracefully", () => {
        const tree = toTree(`
      <Steps>
        <h1>Step 1</h1>
        <p>This is some content within step 1</p>
        <h2>Subheading</h2>
        <p>This is some content within subheading</p>
        <h1>Step 2</h1>
        <p>This is some content within step 2</p>
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup tocDepth=\"1\">
        <Step id="step-1" title={<>{"Step 1"}</>}>
          <p>
            This is some content within step 1
          </p>

          <h2 id="subheading">
            Subheading
          </h2>

          <p>
            This is some content within subheading
          </p>
        </Step>

        <Step id="step-2" title={<>{"Step 2"}</>}>
          <p>
            This is some content within step 2
          </p>
        </Step>
      </StepGroup>
      "
    `);
    });

    it.skip("should gracefully handle untitled steps", () => {
        const tree = toTree(`
      <Steps>
        Some content without a step title

        ### Step 2

        Some content within step 2
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        console.log(hastToMarkdown(tree));
        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup tocDepth=\"3\">
        <Step title={<></>}>
          Some content without a step title
        </Step>

        <Step id="step-2" title="Step 2">
          Some content within step 2
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should handle steps with mixed content types", () => {
        const tree = toTree(`
      <Steps>
        <Step>
          Step with <strong>bold</strong> text
        </Step>
        <Step>
          Step with <em>italic</em> text
        </Step>
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup>
        <Step id="step">
          Step with <strong>bold</strong> text
        </Step>

        <Step id="step-1">
          Step with <em>italic</em> text
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should handle empty steps gracefully", () => {
        const tree = toTree(`
      <Steps>
        <Step></Step>
        <Step>
          Step 2
        </Step>
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup>
        <Step id="step" />

        <Step id="step-1">
          Step 2
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should handle steps with images", () => {
        const tree = toTree(`
      <Steps>
        <Step>
          <img src="image1.png" alt="Image 1" />
          Step 1
        </Step>
        <Step>
          <img src="image2.png" alt="Image 2" />
          Step 2
        </Step>
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup>
        <Step id="step">
          <img src="image1.png" alt="Image 1" />

          Step 1
        </Step>

        <Step id="step-1">
          <img src="image2.png" alt="Image 2" />

          Step 2
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should handle nested steps gracefully", () => {
        const tree = toTree(`
      <Steps>
        <Step>
          <Step>
            Nested step 1
          </Step>
        </Step>
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup>
        <Step id="step">
          <StepGroup>
            <Step id="step-1">
              Nested step 1
            </Step>
          </StepGroup>
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should handle nested steps with mixed content types", () => {
        const tree = toTree(`
      <Steps>
        ### Step 1

        <Steps>
          ### Nested step 1

          Some content within nested step 1

          ### Nested step 2

          Some content within nested step 2
        </Steps>

        ### Step 2

        <Steps>
          ### Nested step 3

          Some content within nested step 3
        </Steps>

      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup tocDepth=\"3\">
        <Step id="step-1" title="Step 1">
          <StepGroup tocDepth=\"3\">
            <Step id="nested-step-1" title="Nested step 1">
              Some content within nested step 1
            </Step>

            <Step id="nested-step-2" title="Nested step 2">
              Some content within nested step 2
            </Step>
          </StepGroup>
        </Step>

        <Step id="step-2" title="Step 2">
          <StepGroup tocDepth=\"3\">
            <Step id="nested-step-3" title="Nested step 3">
              Some content within nested step 3
            </Step>
          </StepGroup>
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should extract text from step titles with MDX content (backticks)", () => {
        const tree = toTree(`
      <Steps>
        ### Install the \`fern-api\` package

        Run the installation command

        ### Configure \`fern.config.json\`

        Set up your configuration file
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup tocDepth=\"3\">
        <Step id="install-the-fern-api-package" title={<>{"Install the "}<code>{"fern-api"}</code>{" package"}</>}>
          Run the installation command
        </Step>

        <Step id="configure-fernconfigjson" title={<>{"Configure "}<code>{"fern.config.json"}</code></>}>
          Set up your configuration file
        </Step>
      </StepGroup>
      "
    `);
    });

    it("should extract text from step titles with bold and italic MDX", () => {
        const tree = toTree(`
      <Steps>
        ### **Important**: First step

        This is a critical step

        ### *Optional*: Second step

        This step is optional
      </Steps>
    `).hast;

        handleSteps(tree);
        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<StepGroup tocDepth=\"3\">
        <Step id="important-first-step" title={<><strong>{"Important"}</strong>{": First step"}</>}>
          This is a critical step
        </Step>

        <Step id="optional-second-step" title={<><em>{"Optional"}</em>{": Second step"}</>}>
          This step is optional
        </Step>
      </StepGroup>
      "
    `);
    });
});
