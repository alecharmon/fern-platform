import { hastToMarkdown, toTree } from "@fern-docs/mdx";

import { rehypeSlug } from "./rehype-slug";

const handleSlug = (rehypeSlug as any)({
    additionalJsxElements: ["ParamField"]
});

describe("rehype-slug with ParamField", () => {
    it("should generate unique IDs for ParamField components", () => {
        const tree = toTree(`
      <ParamField path="username" type="string" required={true} title="username">
        The user's display name
      </ParamField>

      <ParamField path="username" type="string" required={true} title="username">
        Another username field
      </ParamField>

      <ParamField path="api_key" type="string" deprecated={true} title="api_key">
        Use OAuth authentication instead
      </ParamField>
    `).hast;

        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<ParamField path="username" type="string" required={true} title="username" id="username">
        The user's display name
      </ParamField>

      <ParamField path="username" type="string" required={true} title="username" id="username-1">
        Another username field
      </ParamField>

      <ParamField path="api_key" type="string" deprecated={true} title="api_key" id="api_key">
        Use OAuth authentication instead
      </ParamField>
      "
    `);
    });

    it("should handle different ParamField attribute types", () => {
        const tree = toTree(`
      <ParamField query="limit" type="number" default="50" title="limit">
        Maximum number of items to return
      </ParamField>

      <ParamField body="data" type="object" title="data">
        Request body data
      </ParamField>

      <ParamField header="Authorization" type="string" required={true} title="Authorization">
        Authorization header
      </ParamField>
    `).hast;

        handleSlug(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<ParamField query="limit" type="number" default="50" title="limit" id="limit">
        Maximum number of items to return
      </ParamField>

      <ParamField body="data" type="object" title="data" id="data">
        Request body data
      </ParamField>

      <ParamField header="Authorization" type="string" required={true} title="Authorization" id="authorization">
        Authorization header
      </ParamField>
      "
    `);
    });
});
