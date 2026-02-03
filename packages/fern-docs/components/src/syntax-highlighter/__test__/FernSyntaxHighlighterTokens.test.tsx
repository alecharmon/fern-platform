import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FernSyntaxHighlighterTokens } from "../FernSyntaxHighlighterTokens";
import { createRawTokens } from "../fernShiki";

/**
 * @vitest-environment jsdom
 */

// Mock ResizeObserver which is not available in jsdom
beforeAll(() => {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
    }));
});

afterEach(cleanup);

describe("FernSyntaxHighlighterTokens", () => {
    describe("showLineNumbers prop", () => {
        const sampleCode = `const greeting = "Hello";
console.log(greeting);`;

        it("should show line numbers by default", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBeGreaterThan(0);
            expect(gutterElements[0]?.textContent).toBe("1");
            expect(gutterElements[1]?.textContent).toBe("2");
        });

        it("should show line numbers when showLineNumbers is true", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBeGreaterThan(0);
            expect(gutterElements[0]?.textContent).toBe("1");
            expect(gutterElements[1]?.textContent).toBe("2");
        });

        it("should hide line numbers when showLineNumbers is false", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={false} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(0);
        });

        it("should not show colgroup when showLineNumbers is false", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={false} />);

            const colgroupElements = document.querySelectorAll("colgroup");
            expect(colgroupElements.length).toBe(0);
        });

        it("should show colgroup when showLineNumbers is true", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const colgroupElements = document.querySelectorAll("colgroup");
            expect(colgroupElements.length).toBe(1);
        });

        it("should not show line numbers for plaintext regardless of showLineNumbers", () => {
            const tokens = createRawTokens(sampleCode, "plaintext");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(0);
        });

        it("should show $ for each new command in bash/cli when showLineNumbers is true", () => {
            const bashCode = `echo "Hello"
echo "World"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(2);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe("$");
        });

        it("should show > for continuation lines when previous line ends with backslash", () => {
            const bashCode = `docker run \\
  --name container \\
  image:latest`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(3);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe(">");
            expect(gutterElements[2]?.textContent).toBe(">");
        });

        it("should show > for lines inside unclosed single quotes", () => {
            const bashCode = `curl -X POST https://example.com \\
     -d '{
  "name": "value"
}'`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(4);
            expect(gutterElements[0]?.textContent).toBe("$"); // First line
            expect(gutterElements[1]?.textContent).toBe(">"); // Backslash continuation + unclosed '
            expect(gutterElements[2]?.textContent).toBe(">"); // Inside unclosed '
            expect(gutterElements[3]?.textContent).toBe(">"); // Closes ' at end
        });

        it("should show > for lines inside unclosed double quotes", () => {
            const bashCode = `echo "This is a
multi-line
string"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(3);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe(">");
            expect(gutterElements[2]?.textContent).toBe(">");
        });

        it("should show > for lines inside unclosed braces", () => {
            const bashCode = `jq '{
  name: .name,
  value: .value
}'`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(4);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe(">");
            expect(gutterElements[2]?.textContent).toBe(">");
            expect(gutterElements[3]?.textContent).toBe(">");
        });

        it("should show > for lines inside unclosed brackets", () => {
            const bashCode = `echo [
  "item1",
  "item2"
]`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(4);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe(">");
            expect(gutterElements[2]?.textContent).toBe(">");
            expect(gutterElements[3]?.textContent).toBe(">");
        });

        it("should show $ when all delimiters are closed", () => {
            const bashCode = `echo '{}'
echo "done"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(2);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe("$"); // New command after delimiters closed
        });

        it("should not track brackets inside quotes", () => {
            const bashCode = `echo 'some { brackets } here'
echo "next command"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(2);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe("$"); // Brackets were inside quotes
        });

        it("should handle the complex curl example correctly", () => {
            const bashCode = `curl -X POST https://example.com \\
     -H "Content-Type: application/json" \\
     -u "<project_id>:<api_token>" \\
     -d '{
  "name": "Test name"
}'`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(6);
            expect(gutterElements[0]?.textContent).toBe("$"); // curl command starts
            expect(gutterElements[1]?.textContent).toBe(">"); // Backslash continuation
            expect(gutterElements[2]?.textContent).toBe(">"); // Backslash continuation
            expect(gutterElements[3]?.textContent).toBe(">"); // Backslash continuation + opens '
            expect(gutterElements[4]?.textContent).toBe(">"); // Inside unclosed '
            expect(gutterElements[5]?.textContent).toBe(">"); // Closes ' at end
        });

        it("should hide $ and > for bash/cli when showLineNumbers is false", () => {
            const bashCode = `echo "Hello"
echo "World"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={false} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(0);
        });

        it("should still render code content when showLineNumbers is false", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={false} />);

            const contentElements = document.querySelectorAll(".code-block-line-content");
            expect(contentElements.length).toBe(2);
        });
    });

    describe("hideLinePrefixes prop", () => {
        const sampleCode = `const greeting = "Hello";
console.log(greeting);`;

        it("should show line prefixes by default (hideLinePrefixes=false)", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBeGreaterThan(0);
        });

        it("should hide all line prefixes when hideLinePrefixes is true", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} hideLinePrefixes={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(0);
        });

        it("should hide $ and > for bash/cli when hideLinePrefixes is true", () => {
            const bashCode = `echo "Hello"
echo "World"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} hideLinePrefixes={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(0);
        });

        it("should still render code content when hideLinePrefixes is true", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} hideLinePrefixes={true} />);

            const contentElements = document.querySelectorAll(".code-block-line-content");
            expect(contentElements.length).toBe(2);
        });

        it("should not show colgroup when hideLinePrefixes is true", () => {
            const tokens = createRawTokens(sampleCode, "typescript");
            render(<FernSyntaxHighlighterTokens tokens={tokens} hideLinePrefixes={true} />);

            const colgroupElements = document.querySelectorAll("colgroup");
            expect(colgroupElements.length).toBe(0);
        });
    });
});
