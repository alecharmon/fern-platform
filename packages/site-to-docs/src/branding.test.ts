import { describe, expect, it } from "vitest";
import {
    decodeHtmlEntities,
    extractAccentColor,
    extractBranding,
    extractFavicon,
    extractLogo,
    getExtensionFromUrl,
    isLightColor,
    lightenColor,
    normalizeHexColor,
    parseCssColor,
    rgbToHex
} from "./branding.js";

describe("decodeHtmlEntities", () => {
    it("decodes &amp; to &", () => {
        expect(decodeHtmlEntities("foo&amp;bar")).toBe("foo&bar");
    });

    it("decodes multiple &amp; in URL", () => {
        const encoded = "https://example.com/image.svg?a=1&amp;b=2&amp;c=3";
        expect(decodeHtmlEntities(encoded)).toBe("https://example.com/image.svg?a=1&b=2&c=3");
    });

    it("decodes &lt; &gt; &quot;", () => {
        expect(decodeHtmlEntities("&lt;div&gt;")).toBe("<div>");
        expect(decodeHtmlEntities("&quot;hello&quot;")).toBe('"hello"');
    });

    it("decodes numeric entities", () => {
        expect(decodeHtmlEntities("&#60;")).toBe("<");
        expect(decodeHtmlEntities("&#x3C;")).toBe("<");
    });

    it("returns string unchanged if no entities", () => {
        expect(decodeHtmlEntities("hello world")).toBe("hello world");
    });
});

describe("extractLogo", () => {
    const baseUrl = "https://example.com/docs";

    it("extracts logo from img tag with logo in alt", () => {
        const html = '<img alt="Company Logo" src="/images/logo.svg">';
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.light).toBe("https://example.com/images/logo.svg");
        expect(logo?.dark).toBe("https://example.com/images/logo.svg");
    });

    it("extracts logo from img tag with logo in class", () => {
        const html = '<img class="site-logo" src="/logo.png">';
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.light).toBe("https://example.com/logo.png");
    });

    it("extracts logo from img tag with logo in id", () => {
        const html = '<img id="main-logo" src="/assets/brand.svg">';
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.light).toBe("https://example.com/assets/brand.svg");
    });

    it("extracts logo from img src containing 'logo'", () => {
        const html = '<img src="/images/my-logo-image.png">';
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.light).toBe("https://example.com/images/my-logo-image.png");
    });

    it("identifies dark and light logo variants from class", () => {
        const html = `
            <img class="logo-dark" src="/logo-dark.svg">
            <img class="logo-light" src="/logo-light.svg">
        `;
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.dark).toBe("https://example.com/logo-dark.svg");
        expect(logo?.light).toBe("https://example.com/logo-light.svg");
    });

    it("identifies dark and light logo variants from src filename", () => {
        const html = `
            <img src="/images/logo-dark.png">
            <img src="/images/logo-light.png">
        `;
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.dark).toBe("https://example.com/images/logo-dark.png");
        expect(logo?.light).toBe("https://example.com/images/logo-light.png");
    });

    it("falls back to og:image if no logo found", () => {
        const html = '<meta property="og:image" content="https://example.com/social-image.png">';
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeDefined();
        expect(logo?.light).toBe("https://example.com/social-image.png");
    });

    it("prefers explicit logo over og:image", () => {
        const html = `
            <img class="logo" src="/logo.svg">
            <meta property="og:image" content="https://example.com/social.png">
        `;
        const logo = extractLogo(html, baseUrl);
        expect(logo?.light).toBe("https://example.com/logo.svg");
    });

    it("sets href to site root", () => {
        const html = '<img alt="logo" src="/logo.png">';
        const logo = extractLogo(html, baseUrl);
        expect(logo?.href).toBe("https://example.com");
    });

    it("resolves relative URLs against base", () => {
        const html = '<img alt="logo" src="logo.png">';
        const logo = extractLogo(html, "https://example.com/docs/page");
        expect(logo?.light).toBe("https://example.com/docs/logo.png");
    });

    it("returns undefined when no logo found", () => {
        const html = "<html><body><p>No logo here</p></body></html>";
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeUndefined();
    });

    it("skips data: URLs", () => {
        const html = '<img alt="logo" src="data:image/svg+xml;base64,...">';
        const logo = extractLogo(html, baseUrl);
        expect(logo).toBeUndefined();
    });

    it("handles og:image with content before property", () => {
        const html = '<meta content="https://example.com/og.png" property="og:image">';
        const logo = extractLogo(html, baseUrl);
        expect(logo?.light).toBe("https://example.com/og.png");
    });

    it("decodes HTML entities in logo URLs", () => {
        const html = '<img alt="logo" src="https://cdn.example.com/logo.svg?a=1&amp;b=2&amp;c=3">';
        const logo = extractLogo(html, baseUrl);
        expect(logo?.light).toBe("https://cdn.example.com/logo.svg?a=1&b=2&c=3");
    });
});

describe("extractFavicon", () => {
    const baseUrl = "https://example.com";

    it("extracts favicon from link rel=icon", () => {
        const html = '<link rel="icon" href="/favicon.ico">';
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBe("https://example.com/favicon.ico");
    });

    it("extracts favicon from link rel='shortcut icon'", () => {
        const html = '<link rel="shortcut icon" href="/favicon.png">';
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBe("https://example.com/favicon.png");
    });

    it("extracts favicon with href before rel", () => {
        const html = '<link href="/icon.svg" rel="icon">';
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBe("https://example.com/icon.svg");
    });

    it("falls back to apple-touch-icon", () => {
        const html = '<link rel="apple-touch-icon" href="/apple-icon.png">';
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBe("https://example.com/apple-icon.png");
    });

    it("prefers icon over apple-touch-icon", () => {
        const html = `
            <link rel="icon" href="/favicon.ico">
            <link rel="apple-touch-icon" href="/apple-icon.png">
        `;
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBe("https://example.com/favicon.ico");
    });

    it("returns undefined when no favicon found", () => {
        const html = "<html><head><title>Page</title></head></html>";
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBeUndefined();
    });

    it("resolves relative URLs", () => {
        const html = '<link rel="icon" href="assets/favicon.ico">';
        const favicon = extractFavicon(html, "https://example.com/docs/");
        expect(favicon).toBe("https://example.com/docs/assets/favicon.ico");
    });

    it("skips data: URLs", () => {
        const html = '<link rel="icon" href="data:image/x-icon;base64,...">';
        const favicon = extractFavicon(html, baseUrl);
        expect(favicon).toBeUndefined();
    });
});

describe("normalizeHexColor", () => {
    it("normalizes 6-digit hex", () => {
        expect(normalizeHexColor("#635bff")).toBe("#635BFF");
    });

    it("converts 3-digit to 6-digit hex", () => {
        expect(normalizeHexColor("#abc")).toBe("#AABBCC");
    });

    it("adds # prefix if missing", () => {
        expect(normalizeHexColor("635bff")).toBe("#635BFF");
    });

    it("handles 8-digit hex (strips alpha)", () => {
        expect(normalizeHexColor("#635bffcc")).toBe("#635BFF");
    });

    it("returns undefined for invalid colors", () => {
        expect(normalizeHexColor("not-a-color")).toBeUndefined();
        expect(normalizeHexColor("#gg")).toBeUndefined();
        expect(normalizeHexColor("")).toBeUndefined();
    });
});

describe("rgbToHex", () => {
    it("converts RGB to hex", () => {
        expect(rgbToHex(99, 91, 255)).toBe("#635BFF");
        expect(rgbToHex(0, 0, 0)).toBe("#000000");
        expect(rgbToHex(255, 255, 255)).toBe("#FFFFFF");
    });

    it("clamps values to 0-255", () => {
        expect(rgbToHex(-10, 300, 128)).toBe("#00FF80");
    });
});

describe("parseCssColor", () => {
    it("parses hex colors", () => {
        expect(parseCssColor("#635BFF")).toBe("#635BFF");
        expect(parseCssColor("#abc")).toBe("#AABBCC");
    });

    it("parses rgb() colors", () => {
        expect(parseCssColor("rgb(99, 91, 255)")).toBe("#635BFF");
        expect(parseCssColor("rgb(0,0,0)")).toBe("#000000");
    });

    it("parses rgba() colors (ignores alpha)", () => {
        expect(parseCssColor("rgba(99, 91, 255, 0.5)")).toBe("#635BFF");
    });

    it("returns undefined for unsupported formats", () => {
        expect(parseCssColor("hsl(240, 100%, 68%)")).toBeUndefined();
        expect(parseCssColor("red")).toBeUndefined();
        expect(parseCssColor("")).toBeUndefined();
    });
});

describe("isLightColor", () => {
    it("identifies light colors", () => {
        expect(isLightColor("#FFFFFF")).toBe(true);
        expect(isLightColor("#FFFF00")).toBe(true); // Yellow
        expect(isLightColor("#90EE90")).toBe(true); // Light green
    });

    it("identifies dark colors", () => {
        expect(isLightColor("#000000")).toBe(false);
        expect(isLightColor("#0000FF")).toBe(false); // Blue
        expect(isLightColor("#635BFF")).toBe(false); // Purple
    });
});

describe("lightenColor", () => {
    it("lightens dark colors", () => {
        const original = "#000000";
        const lightened = lightenColor(original, 0.5);
        // Should be closer to white
        expect(lightened).toBe("#808080");
    });

    it("produces valid hex output", () => {
        const result = lightenColor("#635BFF", 0.25);
        expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });
});

describe("extractAccentColor", () => {
    it("extracts color from theme-color meta tag", () => {
        const html = '<meta name="theme-color" content="#635BFF">';
        const color = extractAccentColor(html);
        expect(color).toBeDefined();
        expect(color?.light).toBe("#635BFF");
    });

    it("extracts color from theme-color with content first", () => {
        const html = '<meta content="#00FF00" name="theme-color">';
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#00FF00");
    });

    it("extracts CSS variable --primary-color", () => {
        const html = `
            <style>
                :root {
                    --primary-color: #FF5733;
                }
            </style>
        `;
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#FF5733");
    });

    it("extracts CSS variable --accent", () => {
        const html = `
            <style>
                :root { --accent: #123456; }
            </style>
        `;
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#123456");
    });

    it("extracts CSS variable --brand", () => {
        const html = `
            <style>
                :root { --brand: rgb(99, 91, 255); }
            </style>
        `;
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#635BFF");
    });

    it("generates dark mode variant when only light mode found", () => {
        const html = '<meta name="theme-color" content="#635BFF">';
        const color = extractAccentColor(html);
        expect(color?.dark).toBeDefined();
        expect(color?.dark).not.toBe(color?.light);
    });

    it("returns undefined when no color found", () => {
        const html = "<html><body>No colors here</body></html>";
        const color = extractAccentColor(html);
        expect(color).toBeUndefined();
    });

    it("prefers theme-color over CSS variables", () => {
        const html = `
            <meta name="theme-color" content="#111111">
            <style>:root { --primary: #222222; }</style>
        `;
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#111111");
    });

    it("extracts from msapplication-TileColor meta tag", () => {
        const html = '<meta name="msapplication-TileColor" content="#16A34A">';
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#16A34A");
    });

    it("extracts from JSON colors config", () => {
        const html = '"colors":{"primary":"#16A34A","light":"#07C983","dark":"#15803D"}';
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#16A34A");
        expect(color?.dark).toBe("#15803D");
    });

    it("extracts from escaped JSON colors config", () => {
        const html = String.raw`\"colors\":{\"primary\":\"#FF5733\"}`;
        const color = extractAccentColor(html);
        expect(color?.light).toBe("#FF5733");
    });
});

describe("extractBranding", () => {
    const baseUrl = "https://example.com";

    it("extracts all branding elements", () => {
        const html = `
            <html>
            <head>
                <link rel="icon" href="/favicon.ico">
                <meta name="theme-color" content="#635BFF">
            </head>
            <body>
                <img class="logo" src="/logo.svg">
            </body>
            </html>
        `;
        const branding = extractBranding(html, baseUrl);

        expect(branding.logo).toBeDefined();
        expect(branding.logo?.light).toBe("https://example.com/logo.svg");
        expect(branding.favicon).toBe("https://example.com/favicon.ico");
        expect(branding.accentColor?.light).toBe("#635BFF");
    });

    it("returns empty object when no branding found", () => {
        const html = "<html><body>Plain page</body></html>";
        const branding = extractBranding(html, baseUrl);

        expect(branding.logo).toBeUndefined();
        expect(branding.favicon).toBeUndefined();
        expect(branding.accentColor).toBeUndefined();
    });

    it("handles partial branding (only favicon)", () => {
        const html = '<link rel="icon" href="/icon.png">';
        const branding = extractBranding(html, baseUrl);

        expect(branding.favicon).toBe("https://example.com/icon.png");
        expect(branding.logo).toBeUndefined();
        expect(branding.accentColor).toBeUndefined();
    });

    it("handles partial branding (only color)", () => {
        const html = '<meta name="theme-color" content="#FF0000">';
        const branding = extractBranding(html, baseUrl);

        expect(branding.accentColor?.light).toBe("#FF0000");
        expect(branding.logo).toBeUndefined();
        expect(branding.favicon).toBeUndefined();
    });
});

describe("getExtensionFromUrl", () => {
    it("extracts common image extensions", () => {
        expect(getExtensionFromUrl("https://example.com/logo.svg")).toBe("svg");
        expect(getExtensionFromUrl("https://example.com/logo.png")).toBe("png");
        expect(getExtensionFromUrl("https://example.com/logo.jpg")).toBe("jpg");
        expect(getExtensionFromUrl("https://example.com/logo.jpeg")).toBe("jpeg");
        expect(getExtensionFromUrl("https://example.com/logo.ico")).toBe("ico");
        expect(getExtensionFromUrl("https://example.com/logo.webp")).toBe("webp");
        expect(getExtensionFromUrl("https://example.com/logo.gif")).toBe("gif");
    });

    it("returns png as default for unknown extensions", () => {
        expect(getExtensionFromUrl("https://example.com/logo.xyz")).toBe("png");
        expect(getExtensionFromUrl("https://example.com/logo")).toBe("png");
    });

    it("handles URLs with query params", () => {
        expect(getExtensionFromUrl("https://example.com/logo.svg?v=123")).toBe("svg");
    });

    it("handles invalid URLs gracefully", () => {
        expect(getExtensionFromUrl("not-a-url")).toBe("png");
    });
});
