import { hastToMarkdown, toTree } from "@fern-docs/mdx";

import { rehypeParamField } from "./rehype-param-field";

const handleParamField = (rehypeParamField as any)();

describe("rehype-param-field", () => {
    it("should add title attribute to ParamField components", () => {
        const tree = toTree(`
      <ParamField path="username" type="string" required={true}>
        The user's display name
      </ParamField>

      <ParamField query="limit" type="number" default="50">
        Maximum number of items to return
      </ParamField>

      <ParamField body="data" type="object">
        Request body data
      </ParamField>

      <ParamField header="Authorization" type="string" required={true}>
        Authorization header
      </ParamField>
    `).hast;

        handleParamField(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<ParamField path="username" type="string" required={true} title="username">
        The user's display name
      </ParamField>

      <ParamField query="limit" type="number" default="50" title="limit">
        Maximum number of items to return
      </ParamField>

      <ParamField body="data" type="object" title="data">
        Request body data
      </ParamField>

      <ParamField header="Authorization" type="string" required={true} title="Authorization">
        Authorization header
      </ParamField>
      "
    `);
    });

    it("should not add title if it already exists", () => {
        const tree = toTree(`
      <ParamField path="username" type="string" title="Custom Title">
        The user's display name
      </ParamField>
    `).hast;

        handleParamField(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<ParamField path="username" type="string" title="Custom Title">
        The user's display name
      </ParamField>
      "
    `);
    });

    it("should not add title if no valid name attribute is found", () => {
        const tree = toTree(`
      <ParamField type="string" required={true}>
        Field without name attributes
      </ParamField>
    `).hast;

        handleParamField(tree);

        expect(hastToMarkdown(tree)).toMatchInlineSnapshot(`
      "<ParamField type="string" required={true}>
        Field without name attributes
      </ParamField>
      "
    `);
    });
});
