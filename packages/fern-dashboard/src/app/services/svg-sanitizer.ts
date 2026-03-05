/**
 * Shared DOMPurify configuration for SVG sanitization.
 * Used by both server-side (upload) and client-side (rendering) sanitization
 * to ensure consistent security rules across all SVG processing paths.
 */
export const SVG_SANITIZE_CONFIG = {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Remove all script-related elements and elements that can dynamically modify content
    FORBID_TAGS: ["script", "foreignObject", "set", "animate", "animateTransform", "animateMotion"],
    // Remove all event handler attributes and other dangerous attributes
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
 * Lazily loads DOMPurify via dynamic import to avoid crashing the module
 * at load time in Vercel serverless functions (jsdom has native deps that
 * can cause bundling issues with top-level imports).
 */
async function getDOMPurify(): Promise<typeof import("isomorphic-dompurify").default> {
    const mod = await import("isomorphic-dompurify");
    return mod.default;
}

/**
 * Sanitizes an SVG string to remove potentially dangerous content like
 * <script> tags, on* event handlers, and other XSS vectors.
 *
 * Can be used on both server-side and client-side.
 */
export async function sanitizeSvgString(svgString: string): Promise<string> {
    const DOMPurify = await getDOMPurify();
    return DOMPurify.sanitize(svgString, SVG_SANITIZE_CONFIG);
}

/**
 * Sanitizes an SVG buffer to remove potentially dangerous content.
 * This is used server-side to sanitize SVG file uploads before storing in S3.
 */
export async function sanitizeSvg(buffer: Buffer): Promise<Buffer> {
    const svgString = buffer.toString("utf-8");
    const cleanSvg = await sanitizeSvgString(svgString);
    return Buffer.from(cleanSvg, "utf-8");
}

/**
 * Checks whether a given MIME type is an SVG image type.
 */
export function isSvgMimeType(mimeType: string): boolean {
    return mimeType === "image/svg+xml";
}
