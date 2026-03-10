/**
 * @vitest-environment node
 */
import { getFrontmatter, sanitizeBreaks, sanitizeMdxExpression, toTree } from "@fern-docs/mdx";

vi.mock("server-only", () => ({}));

/**
 * These tests validate the sanitization → toTree pipeline used
 * in the local fallback path of serializeDescription.
 *
 * The fix ensures that toTree receives pre-sanitized content
 * (contentWithoutFrontmatter) rather than the raw unsanitized input.
 */
describe("serializeDescription sanitization pipeline", () => {
    function sanitizeAndStripFrontmatter(content: string): string {
        let sanitized = sanitizeBreaks(content);
        sanitized = sanitizeMdxExpression(sanitized)[0];
        const { content: contentWithoutFrontmatter } = getFrontmatter(sanitized);
        return contentWithoutFrontmatter;
    }

    it("should not throw when toTree receives sanitized content with <country code> placeholder", () => {
        const content = `URL to play.
Required if \`urls\` is not present.
Allowed URLs are:
    - http:// or https:// - audio file to GET
    - ring:[duration:]<country code> - ring tone to play`;

        const sanitized = sanitizeAndStripFrontmatter(content);
        expect(() => toTree(sanitized, { sanitize: false })).not.toThrow();
    });

    it("should throw when toTree receives unsanitized content with <country code> placeholder", () => {
        const content = `URL to play.
Required if \`urls\` is not present.
Allowed URLs are:
    - http:// or https:// - audio file to GET
    - ring:[duration:]<country code> - ring tone to play`;

        expect(() => toTree(content, { sanitize: false })).toThrow();
    });

    it("should not throw when toTree receives sanitized content with <duration> placeholder", () => {
        const content = `URL or array of URLs to play.
Allowed URLs are:
    http:// or https:// - audio file to GET
    ring:[duration:]<country code> - ring tone to play. For example: ring:us to play single ring or ring:20.`;

        const sanitized = sanitizeAndStripFrontmatter(content);
        expect(() => toTree(sanitized, { sanitize: false })).not.toThrow();
    });

    it("should not throw when toTree receives sanitized content with <section_name> placeholder", () => {
        const content = "Body text for <section_name> of the document";

        const sanitized = sanitizeAndStripFrontmatter(content);
        expect(() => toTree(sanitized, { sanitize: false })).not.toThrow();
    });

    it("should not throw when toTree receives sanitized content with multiple placeholders", () => {
        const content = "Format: <country>-<region>-<zone>";

        const sanitized = sanitizeAndStripFrontmatter(content);
        expect(() => toTree(sanitized, { sanitize: false })).not.toThrow();
    });

    it("should preserve valid JSX elements after sanitization", () => {
        const content = "<Callout>important info</Callout>";

        const sanitized = sanitizeAndStripFrontmatter(content);
        const { jsxElements } = toTree(sanitized, { sanitize: false });
        expect(jsxElements).toContain("Callout");
    });

    it("should handle plain text without issues", () => {
        const content = "A simple description with no special characters.";

        const sanitized = sanitizeAndStripFrontmatter(content);
        const { jsxElements } = toTree(sanitized, { sanitize: false });
        expect(jsxElements).toEqual([]);
    });

    it("should handle content with backtick-wrapped code", () => {
        const content = "Default is `0`.\nValid range is -40 to 40.";

        const sanitized = sanitizeAndStripFrontmatter(content);
        expect(() => toTree(sanitized, { sanitize: false })).not.toThrow();
    });
});
