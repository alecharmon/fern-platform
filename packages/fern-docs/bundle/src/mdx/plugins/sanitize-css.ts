/**
 * Sanitizes CSS strings to prevent injection attacks.
 *
 * Strips dangerous CSS constructs that can be used for code execution or
 * loading arbitrary external resources — even without JavaScript. This includes:
 *
 * - `@import` — can load arbitrary external stylesheets
 * - `expression()` — legacy IE scripting in CSS
 * - `-moz-binding` — legacy Firefox XBL bindings
 * - `behavior` — legacy IE HTC behaviors
 * - `javascript:` URIs
 *
 * Note: `url()` is intentionally NOT blocked because customers legitimately
 * use it for background images, custom fonts, etc. in their docs styles.
 */

/**
 * Patterns that are removed from CSS strings. Each entry is a regex that
 * matches a dangerous construct and its surrounding value/declaration.
 */
const DANGEROUS_CSS_PATTERNS: readonly RegExp[] = [
    // @import — blocks loading of external stylesheets
    /@import\s[^;]*;?/gi,

    // expression(...) — legacy IE CSS expression (allows JS execution)
    /expression\s*\([^)]*\)/gi,

    // -moz-binding — legacy Firefox XBL bindings
    /-moz-binding\s*:\s*[^;}"']*/gi,

    // behavior — legacy IE HTC behaviors
    /behavior\s*:\s*[^;}"']*/gi,

    // javascript: URIs (in case they appear in CSS values)
    /javascript\s*:/gi
];

/**
 * Sanitizes a CSS string by removing dangerous patterns that could be used
 * for CSS injection attacks (data exfiltration, phishing, clickjacking).
 *
 * Safe CSS properties (colors, layout, typography, etc.) are preserved.
 */
export function sanitizeCss(css: string): string {
    let sanitized = css;
    for (const pattern of DANGEROUS_CSS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "/* [sanitized] */");
    }
    return sanitized;
}
