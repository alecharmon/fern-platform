import { describe, expect, it } from "vitest";
import { maybeRemoveIfComponents } from "../maybe-remove-if-components";

describe("maybeRemoveIfComponents", () => {
    it("should remove simple If component with content", () => {
        const input = `
# Hello World

<If roles={["admin"]}>
  This is admin-only content.
</If>

Regular content here.
`;

        const expected = `
# Hello World



Regular content here.
`;

        expect(maybeRemoveIfComponents(input)).toBe(expected);
    });

    it("should remove If component with nested content", () => {
        const input = `
<If roles={["beta-users"]}>
  <Callout>
    This callout is only visible to beta users.
  </Callout>
</If>
`;

        const expected = `

`;

        expect(maybeRemoveIfComponents(input)).toBe(expected);
    });

    it("should remove multiple If components", () => {
        const input = `
Some public content.

<If roles={["admin"]}>
  Admin content
</If>

More public content.

<If roles={["beta"]}>
  Beta content
</If>

Final public content.
`;

        const expected = `
Some public content.



More public content.



Final public content.
`;

        expect(maybeRemoveIfComponents(input)).toBe(expected);
    });

    it("should handle If component with complex attributes", () => {
        const input = `
<If roles={["admin", "editor"]} not>
  Content for non-admins
</If>
`;

        const expected = `

`;

        expect(maybeRemoveIfComponents(input)).toBe(expected);
    });

    it("should handle self-closing If component", () => {
        const input = `
Before
<If roles={["admin"]} />
After
`;

        const expected = `
Before

After
`;

        expect(maybeRemoveIfComponents(input)).toBe(expected);
    });

    it("should not affect content without If components", () => {
        const input = `
# Title

Regular markdown content here.

- List item 1
- List item 2

\`\`\`typescript
const code = "example";
\`\`\`
`;

        expect(maybeRemoveIfComponents(input)).toBe(input);
    });

    it("should handle If components with multiline content", () => {
        const input = `
<If roles={["premium"]}>
## Premium Feature

This is a long section
with multiple paragraphs.

And code blocks too:

\`\`\`javascript
console.log("premium");
\`\`\`
</If>
`;

        const expected = `

`;

        expect(maybeRemoveIfComponents(input)).toBe(expected);
    });
});
