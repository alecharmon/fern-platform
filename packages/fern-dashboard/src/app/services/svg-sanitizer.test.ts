// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mock isomorphic-dompurify to avoid broken transitive dependency chain
// (jsdom@latest -> html-encoding-sniffer -> @exodus/bytes ESM incompatibility).
// vi.mock is hoisted, so we use vi.hoisted() to define the mock function.
const { mockSanitize } = vi.hoisted(() => {
    const mockSanitize = vi.fn((input: string) => {
        // Simulate basic sanitization: strip <script> tags, on* attributes, xlink:href
        return input
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<script[^>]*\/>/gi, "")
            .replace(/\s+on\w+="[^"]*"/gi, "")
            .replace(/\s+xlink:href="[^"]*"/gi, "");
    });
    return { mockSanitize };
});

vi.mock("isomorphic-dompurify", () => ({
    default: { sanitize: mockSanitize }
}));

import { isSvgMimeType, SVG_SANITIZE_CONFIG, sanitizeSvg, sanitizeSvgString } from "@/app/services/svg-sanitizer";

describe("SVG_SANITIZE_CONFIG", () => {
    it("includes script in FORBID_TAGS", () => {
        expect(SVG_SANITIZE_CONFIG.FORBID_TAGS).toContain("script");
    });

    it("includes foreignObject in FORBID_TAGS", () => {
        expect(SVG_SANITIZE_CONFIG.FORBID_TAGS).toContain("foreignObject");
    });

    it("includes animation elements in FORBID_TAGS", () => {
        expect(SVG_SANITIZE_CONFIG.FORBID_TAGS).toContain("animate");
        expect(SVG_SANITIZE_CONFIG.FORBID_TAGS).toContain("animateTransform");
        expect(SVG_SANITIZE_CONFIG.FORBID_TAGS).toContain("animateMotion");
        expect(SVG_SANITIZE_CONFIG.FORBID_TAGS).toContain("set");
    });

    it("includes all critical event handler attributes in FORBID_ATTR", () => {
        const criticalHandlers = ["onload", "onerror", "onclick", "onmouseover", "onfocus", "onblur"];
        for (const handler of criticalHandlers) {
            expect(SVG_SANITIZE_CONFIG.FORBID_ATTR).toContain(handler);
        }
    });

    it("includes xlink:href in FORBID_ATTR to prevent external resource loading", () => {
        expect(SVG_SANITIZE_CONFIG.FORBID_ATTR).toContain("xlink:href");
    });

    it("enables SVG and SVG filter profiles", () => {
        expect(SVG_SANITIZE_CONFIG.USE_PROFILES).toEqual({ svg: true, svgFilters: true });
    });
});

describe("sanitizeSvgString", () => {
    it("calls DOMPurify.sanitize with the shared SVG_SANITIZE_CONFIG", async () => {
        mockSanitize.mockClear();
        const input = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
        await sanitizeSvgString(input);

        expect(mockSanitize).toHaveBeenCalledOnce();
        expect(mockSanitize).toHaveBeenCalledWith(input, SVG_SANITIZE_CONFIG);
    });

    it("returns the sanitized output from DOMPurify", async () => {
        mockSanitize.mockClear();
        const input = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="10"/></svg>';
        const result = await sanitizeSvgString(input);

        expect(result).not.toContain("onload");
        expect(result).toContain("<circle");
    });

    it("passes the PoC payload through DOMPurify with correct config", async () => {
        mockSanitize.mockClear();
        const poc =
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.domain)"><text x="10" y="20">SVG with XSS</text></svg>';
        const result = await sanitizeSvgString(poc);

        expect(mockSanitize).toHaveBeenCalledWith(poc, SVG_SANITIZE_CONFIG);
        expect(result).not.toContain("onload");
        expect(result).not.toContain("alert");
    });

    it("handles empty string input", async () => {
        mockSanitize.mockClear();
        const result = await sanitizeSvgString("");
        expect(mockSanitize).toHaveBeenCalledWith("", SVG_SANITIZE_CONFIG);
        expect(result).toBe("");
    });
});

describe("sanitizeSvg", () => {
    it("converts Buffer to string, sanitizes, and returns a Buffer", async () => {
        mockSanitize.mockClear();
        const malicious = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="10"/></svg>';
        const inputBuffer = Buffer.from(malicious, "utf-8");
        const resultBuffer = await sanitizeSvg(inputBuffer);

        expect(resultBuffer).toBeInstanceOf(Buffer);
        expect(mockSanitize).toHaveBeenCalledWith(malicious, SVG_SANITIZE_CONFIG);

        const resultString = resultBuffer.toString("utf-8");
        expect(resultString).not.toContain("onload");
        expect(resultString).toContain("<circle");
    });

    it("preserves valid SVG content through the Buffer round-trip", async () => {
        mockSanitize.mockClear();
        const valid = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="blue"/></svg>';
        const inputBuffer = Buffer.from(valid, "utf-8");
        const resultBuffer = await sanitizeSvg(inputBuffer);

        const resultString = resultBuffer.toString("utf-8");
        expect(resultString).toContain("<rect");
        expect(resultString).toContain('fill="blue"');
    });
});

describe("isSvgMimeType", () => {
    it("returns true for image/svg+xml", () => {
        expect(isSvgMimeType("image/svg+xml")).toBe(true);
    });

    it("returns false for image/png", () => {
        expect(isSvgMimeType("image/png")).toBe(false);
    });

    it("returns false for image/jpeg", () => {
        expect(isSvgMimeType("image/jpeg")).toBe(false);
    });

    it("returns false for image/gif", () => {
        expect(isSvgMimeType("image/gif")).toBe(false);
    });

    it("returns false for text/html", () => {
        expect(isSvgMimeType("text/html")).toBe(false);
    });

    it("returns false for empty string", () => {
        expect(isSvgMimeType("")).toBe(false);
    });

    it("is case-sensitive (rejects IMAGE/SVG+XML)", () => {
        expect(isSvgMimeType("IMAGE/SVG+XML")).toBe(false);
    });
});
