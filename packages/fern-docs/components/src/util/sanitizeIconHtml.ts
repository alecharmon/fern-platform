import DOMPurify, { type Config } from "dompurify";

/**
 * DOMPurify configuration for sanitizing icon HTML strings.
 * Only allows SVG elements and safe attributes — strips all script-related
 * elements and event handler attributes to prevent XSS.
 */
const ICON_SANITIZE_CONFIG: Config = {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "set", "animate", "animateTransform", "animateMotion"],
    FORBID_ATTR: [
        "onload",
        "onerror",
        "onclick",
        "onmouseover",
        "onmouseout",
        "onmouseenter",
        "onmouseleave",
        "onmousedown",
        "onmouseup",
        "onmousemove",
        "onfocus",
        "onblur",
        "oninput",
        "onchange",
        "onsubmit",
        "onkeydown",
        "onkeyup",
        "onkeypress",
        "onanimationstart",
        "onanimationend",
        "onanimationiteration",
        "ontransitionend",
        "onbegin",
        "onend",
        "onrepeat",
        "xlink:href"
    ]
};

/**
 * Regex-based server-side sanitizer for icon HTML strings.
 * Used when DOMPurify is unavailable (no browser DOM). This is critical for
 * React Server Components (e.g. NavbarLinks, processIconStringServer) that are
 * never hydrated on the client — their HTML goes directly to the browser.
 *
 * Covers the same attack vectors as the DOMPurify config:
 * - All on* event handler attributes
 * - <script> tags and content
 * - <foreignObject> tags and content
 * - SVG animation elements (<animate>, <animateTransform>, <animateMotion>, <set>)
 * - xlink:href attributes
 * - Non-SVG dangerous elements (<iframe>, <object>, <embed>, <form>, <input>)
 */
export function serverSanitizeIconHtml(html: string): string {
    let sanitized = html;

    // Strip all on* event handler attributes (e.g. onload, onerror, onbegin, etc.)
    sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

    // Remove <script> tags and their content
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi, "");
    // Also handle self-closing or unclosed script tags
    sanitized = sanitized.replace(/<script\b[^>]*\/?>/gi, "");

    // Remove <foreignObject> tags and their content
    sanitized = sanitized.replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject\s*>/gi, "");
    sanitized = sanitized.replace(/<foreignObject\b[^>]*\/?>/gi, "");

    // Remove SVG animation elements (<animate>, <animateTransform>, <animateMotion>, <set>)
    // Handle both self-closing and open/close variants
    sanitized = sanitized.replace(
        /<(animate|animateTransform|animateMotion|set)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1\s*>/gi,
        ""
    );
    sanitized = sanitized.replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/?>/gi, "");

    // Strip xlink:href attributes
    sanitized = sanitized.replace(/\s+xlink:href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

    // Remove non-SVG dangerous elements
    sanitized = sanitized.replace(/<\/?(iframe|object|embed|form|input|textarea|button)\b[^>]*>/gi, "");

    // Remove <img> tags (not valid SVG; commonly used in XSS payloads like <img src=x onerror=...>)
    sanitized = sanitized.replace(/<img\b[^>]*\/?>/gi, "");

    return sanitized;
}

/**
 * Sanitizes an icon HTML string (expected to be inline SVG) to remove
 * potentially dangerous content like script tags, event handlers, and
 * other XSS vectors before rendering via dangerouslySetInnerHTML.
 *
 * On the client, uses DOMPurify with an SVG-focused config for robust sanitization.
 * On the server (no `window`), uses a regex-based sanitizer to strip known
 * dangerous patterns. This is necessary because React Server Components
 * (e.g. NavbarLinks) are never hydrated on the client.
 */
export function sanitizeIconHtml(html: string): string {
    if (typeof window === "undefined") {
        return serverSanitizeIconHtml(html);
    }
    return DOMPurify.sanitize(html, { ...ICON_SANITIZE_CONFIG, RETURN_TRUSTED_TYPE: false }) as string;
}
