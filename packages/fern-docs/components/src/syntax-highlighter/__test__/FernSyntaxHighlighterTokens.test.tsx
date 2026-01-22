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

        it("should show $ and > for bash/cli when showLineNumbers is true", () => {
            const bashCode = `echo "Hello"
echo "World"`;
            const tokens = createRawTokens(bashCode, "bash");
            render(<FernSyntaxHighlighterTokens tokens={tokens} showLineNumbers={true} />);

            const gutterElements = document.querySelectorAll(".code-block-line-gutter");
            expect(gutterElements.length).toBe(2);
            expect(gutterElements[0]?.textContent).toBe("$");
            expect(gutterElements[1]?.textContent).toBe(">");
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
});
