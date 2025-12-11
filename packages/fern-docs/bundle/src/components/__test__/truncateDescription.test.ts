import { truncateDescription } from "../util/truncateDescription";

describe("truncateDescription", () => {
    describe("undefined and empty inputs", () => {
        it("returns undefined for undefined input", () => {
            expect(truncateDescription(undefined)).toBeUndefined();
        });

        it("returns undefined for empty string", () => {
            expect(truncateDescription("")).toBeUndefined();
        });

        it("returns undefined for whitespace-only string", () => {
            expect(truncateDescription("   ")).toBeUndefined();
        });
    });

    describe("markdown stripping", () => {
        it("removes asterisks (bold/italic)", () => {
            expect(truncateDescription("This is **bold** and *italic* text")).toBe("This is bold and italic text");
        });

        it("removes underscores (bold/italic)", () => {
            expect(truncateDescription("This is __bold__ and _italic_ text")).toBe("This is bold and italic text");
        });

        it("removes backticks (code)", () => {
            expect(truncateDescription("Use the `console.log` function")).toBe("Use the console.log function");
        });

        it("removes hash symbols (headings)", () => {
            expect(truncateDescription("# Heading\n## Subheading")).toBe("Heading Subheading");
        });

        it("removes square brackets (links)", () => {
            expect(truncateDescription("Check out [this link](https://example.com)")).toBe(
                "Check out this link(https://example.com)"
            );
        });

        it("handles multiple markdown symbols together", () => {
            expect(truncateDescription("**`code`** and _[link]_")).toBe("code and link");
        });
    });

    describe("whitespace handling", () => {
        it("collapses multiple spaces", () => {
            expect(truncateDescription("Hello    world")).toBe("Hello world");
        });

        it("collapses newlines to spaces in short text", () => {
            expect(truncateDescription("Hello\nworld")).toBe("Hello world");
        });

        it("collapses tabs to spaces", () => {
            expect(truncateDescription("Hello\tworld")).toBe("Hello world");
        });

        it("trims leading and trailing whitespace", () => {
            expect(truncateDescription("  Hello world  ")).toBe("Hello world");
        });

        it("handles mixed whitespace", () => {
            expect(truncateDescription("  Hello\n\n  world\t\t  ")).toBe("Hello world");
        });
    });

    describe("truncation priority - newline first (no ellipsis)", () => {
        it("truncates at newline when present before maxLength without ellipsis", () => {
            const text = "First line.\nSecond line that makes this text exceed the maximum length limit.";
            const result = truncateDescription(text, 50);
            expect(result).toBe("First line.");
        });

        it("truncates at last newline within maxLength without ellipsis", () => {
            const text = "Line one.\nLine two.\nLine three is very long and exceeds the limit.";
            const result = truncateDescription(text, 30);
            expect(result).toBe("Line one. Line two.");
        });

        it("removes newlines from result after truncation", () => {
            const text = "First\npart.\nSecond part that is very long and exceeds the maximum length.";
            const result = truncateDescription(text, 40);
            expect(result).not.toContain("\n");
        });
    });

    describe("truncation priority - sentence break second (no ellipsis)", () => {
        it("truncates at sentence break when no newline present without ellipsis", () => {
            const text =
                "This is the first sentence. This is the second sentence that makes the text exceed the maximum length limit for descriptions.";
            const result = truncateDescription(text, 50);
            expect(result).toBe("This is the first sentence.");
        });

        it("truncates at exclamation mark without ellipsis", () => {
            const text = "Hello there! This is a longer sentence that exceeds the maximum length limit.";
            const result = truncateDescription(text, 30);
            expect(result).toBe("Hello there!");
        });

        it("truncates at question mark without ellipsis", () => {
            const text = "How are you? This is a longer sentence that exceeds the maximum length limit.";
            const result = truncateDescription(text, 30);
            expect(result).toBe("How are you?");
        });

        it("truncates at last sentence break within maxLength without ellipsis", () => {
            const text = "First. Second. Third sentence that is very long and exceeds the limit.";
            const result = truncateDescription(text, 30);
            expect(result).toBe("First. Second.");
        });
    });

    describe("truncation priority - whitespace third", () => {
        it("truncates at whitespace when no newline or sentence break", () => {
            const text = "This is a description without any sentence breaks that exceeds the maximum length";
            const result = truncateDescription(text, 40);
            expect(result).toBe("This is a description without any…");
        });

        it("truncates at word boundary, not mid-word", () => {
            const text = "Alongwordthatcannotbebroken and then some more text that exceeds the limit";
            const result = truncateDescription(text, 40);
            expect(result).toBe("Alongwordthatcannotbebroken and then…");
        });
    });

    describe("truncation fallback - hard truncate", () => {
        it("hard truncates when no break points found", () => {
            const noSpaces = "A".repeat(200);
            const result = truncateDescription(noSpaces);
            expect(result).not.toBeUndefined();
            expect(result).toBe("A".repeat(160) + "…");
        });

        it("hard truncates single long word", () => {
            const text = "Supercalifragilisticexpialidocious";
            const result = truncateDescription(text, 10);
            expect(result).toBe("Supercalif…");
        });
    });

    describe("no truncation needed", () => {
        it("does not truncate text under maxLength", () => {
            const shortText = "This is a short description.";
            expect(truncateDescription(shortText)).toBe(shortText);
        });

        it("does not truncate text exactly at maxLength", () => {
            const exactText = "A".repeat(160);
            expect(truncateDescription(exactText)).toBe(exactText);
        });

        it("does not add ellipsis when not truncated", () => {
            const text = "Short text without truncation.";
            const result = truncateDescription(text);
            expect(result).not.toContain("…");
        });
    });

    describe("custom maxLength", () => {
        it("respects custom maxLength parameter", () => {
            const text = "This is a test description for custom length.";
            const result = truncateDescription(text, 20);
            expect(result).not.toBeUndefined();
            expect(result!.endsWith("…")).toBe(true);
        });

        it("does not truncate when text is under custom maxLength", () => {
            const text = "Short text";
            expect(truncateDescription(text, 50)).toBe("Short text");
        });

        it("handles very small maxLength", () => {
            const text = "Hello world";
            const result = truncateDescription(text, 5);
            expect(result).not.toBeUndefined();
            expect(result!.endsWith("…")).toBe(true);
        });
    });

    describe("edge cases", () => {
        it("handles text that becomes shorter after markdown stripping", () => {
            const text = "**" + "A".repeat(170) + "**";
            const result = truncateDescription(text);
            expect(result).not.toBeUndefined();
            expect(result!.endsWith("…")).toBe(true);
        });

        it("handles text that becomes under limit after whitespace collapse", () => {
            const text = "Hello" + " ".repeat(100) + "world";
            expect(truncateDescription(text)).toBe("Hello world");
        });

        it("handles unicode characters", () => {
            const text = "Hello 世界 🌍";
            expect(truncateDescription(text)).toBe("Hello 世界 🌍");
        });

        it("handles special characters that are not markdown", () => {
            const text = "Price: $100 (50% off!) & free shipping";
            expect(truncateDescription(text)).toBe("Price: $100 (50% off!) & free shipping");
        });

        it("newline at position 0 is not used as truncation point", () => {
            const text = "\nThis is text that starts with a newline and is long enough to need truncation here.";
            const result = truncateDescription(text, 50);
            expect(result).not.toBe("…");
            expect(result!.length).toBeGreaterThan(1);
        });

        it("handles multiple consecutive newlines without ellipsis", () => {
            const text = "First part.\n\n\nSecond part that is very long and exceeds the maximum length limit.";
            const result = truncateDescription(text, 40);
            expect(result).toBe("First part.");
        });
    });
});
