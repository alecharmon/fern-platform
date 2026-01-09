import type { AccentColor, SiteBranding, SiteLogo } from "./types.js";

// ============================================================================
// HTML Entity Decoding
// ============================================================================

/**
 * Decodes common HTML entities in a string.
 * Handles &amp; &lt; &gt; &quot; &#39; and numeric entities.
 *
 * @param str - The string with HTML entities
 * @returns The decoded string
 */
export function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'")
        .replace(/&#(\d+);/gi, (_, num) => String.fromCharCode(parseInt(num, 10)))
        .replace(/&#x([a-fA-F0-9]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ============================================================================
// Logo Extraction
// Extracts logo URLs from HTML content using various heuristics.
// ============================================================================

/**
 * Extracts logo URLs from HTML content.
 * Looks for logo images in priority order:
 * 1. <img> tags with "logo" in alt, class, or id attributes
 * 2. SVG elements with "logo" identifiers
 * 3. OpenGraph image as fallback
 *
 * @param html - The HTML content to search
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns SiteLogo object with extracted logo URLs, or undefined if none found
 */
export function extractLogo(html: string, baseUrl: string): SiteLogo | undefined {
    const logos: { url: string; isDark?: boolean; priority: number }[] = [];

    // Helper to resolve URLs (decodes HTML entities first)
    const resolveUrl = (href: string): string | undefined => {
        if (!href || href.startsWith("data:")) {
            return undefined;
        }
        try {
            // Decode HTML entities like &amp; -> &
            const decoded = decodeHtmlEntities(href);
            return new URL(decoded, baseUrl).toString();
        } catch {
            return undefined;
        }
    };

    // Pattern 1: <img> tags with "logo" in alt, class, id, or src
    // Priority: highest for explicit logo identifiers
    const imgLogoRegex =
        /<img[^>]*(?:alt|class|id)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)["']|<img[^>]*src=["']([^"']+)["'][^>]*(?:alt|class|id)=["'][^"']*logo[^"']*["']/gi;
    let match: RegExpExecArray | null;

    while ((match = imgLogoRegex.exec(html)) !== null) {
        const src = match[1] ?? match[2];
        if (src) {
            const resolved = resolveUrl(src);
            if (resolved) {
                // Check if this is explicitly a dark or light logo
                const contextLower = match[0].toLowerCase();
                const isDark =
                    contextLower.includes("dark") || contextLower.includes("-dark") || contextLower.includes("_dark");
                const isLight =
                    contextLower.includes("light") ||
                    contextLower.includes("-light") ||
                    contextLower.includes("_light");

                logos.push({
                    url: resolved,
                    isDark: isDark ? true : isLight ? false : undefined,
                    priority: 1
                });
            }
        }
    }

    // Pattern 2: <img> with src containing "logo" in the filename
    const imgSrcLogoRegex = /<img[^>]*src=["']([^"']*logo[^"']*)["']/gi;
    while ((match = imgSrcLogoRegex.exec(html)) !== null) {
        const src = match[1];
        if (src) {
            const resolved = resolveUrl(src);
            if (resolved && !logos.some((l) => l.url === resolved)) {
                const srcLower = src.toLowerCase();
                const isDark = srcLower.includes("-dark") || srcLower.includes("_dark") || srcLower.includes("/dark");
                const isLight =
                    srcLower.includes("-light") || srcLower.includes("_light") || srcLower.includes("/light");

                logos.push({
                    url: resolved,
                    isDark: isDark ? true : isLight ? false : undefined,
                    priority: 2
                });
            }
        }
    }

    // Pattern 3: SVG with "logo" in class or id (inline SVG - skip for now, complex to extract)
    // Pattern 4: <a> containing logo image (extract href for logo link)

    // Pattern 5: OpenGraph image as fallback
    const ogImageRegex =
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i;
    const ogMatch = html.match(ogImageRegex);
    if (ogMatch) {
        const ogImage = ogMatch[1] ?? ogMatch[2];
        if (ogImage) {
            const resolved = resolveUrl(ogImage);
            if (resolved && !logos.some((l) => l.url === resolved)) {
                logos.push({ url: resolved, priority: 5 });
            }
        }
    }

    // No logos found
    if (logos.length === 0) {
        return undefined;
    }

    // Sort by priority (lower is better)
    logos.sort((a, b) => a.priority - b.priority);

    // Build the SiteLogo object
    const result: SiteLogo = {};

    // Try to find the site root for href
    try {
        const parsedBase = new URL(baseUrl);
        result.href = `${parsedBase.protocol}//${parsedBase.host}`;
    } catch {
        // Skip href if URL parsing fails
    }

    // Find dark and light variants
    const darkLogo = logos.find((l) => l.isDark === true);
    const lightLogo = logos.find((l) => l.isDark === false);
    const genericLogo = logos.find((l) => l.isDark === undefined);

    if (darkLogo && lightLogo) {
        // Both variants found
        result.dark = darkLogo.url;
        result.light = lightLogo.url;
    } else if (darkLogo) {
        // Only dark variant found - use for both
        result.dark = darkLogo.url;
        result.light = darkLogo.url;
    } else if (lightLogo) {
        // Only light variant found - use for both
        result.dark = lightLogo.url;
        result.light = lightLogo.url;
    } else if (genericLogo) {
        // Generic logo - use for both
        result.dark = genericLogo.url;
        result.light = genericLogo.url;
    }

    return result.light || result.dark ? result : undefined;
}

// ============================================================================
// Favicon Extraction
// Extracts favicon URL from HTML content.
// ============================================================================

/**
 * Extracts the favicon URL from HTML content.
 * Looks for:
 * 1. <link rel="icon" href="...">
 * 2. <link rel="shortcut icon" href="...">
 * 3. <link rel="apple-touch-icon" href="...">
 *
 * @param html - The HTML content to search
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns Favicon URL, or undefined if not found
 */
export function extractFavicon(html: string, baseUrl: string): string | undefined {
    const resolveUrl = (href: string): string | undefined => {
        if (!href || href.startsWith("data:")) {
            return undefined;
        }
        try {
            // Decode HTML entities like &amp; -> &
            const decoded = decodeHtmlEntities(href);
            return new URL(decoded, baseUrl).toString();
        } catch {
            return undefined;
        }
    };

    // Pattern 1: <link rel="icon"> (highest priority)
    const iconRegex =
        /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']|<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/gi;
    let match = iconRegex.exec(html);
    if (match) {
        const href = match[1] ?? match[2];
        if (href) {
            const resolved = resolveUrl(href);
            if (resolved) {
                return resolved;
            }
        }
    }

    // Pattern 2: <link rel="apple-touch-icon"> (fallback)
    const appleIconRegex =
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']|<link[^>]*href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/gi;
    match = appleIconRegex.exec(html);
    if (match) {
        const href = match[1] ?? match[2];
        if (href) {
            const resolved = resolveUrl(href);
            if (resolved) {
                return resolved;
            }
        }
    }

    return undefined;
}

// ============================================================================
// Color Extraction
// Extracts primary/accent colors from HTML content.
// ============================================================================

/**
 * Validates and normalizes a hex color string.
 * Converts 3-digit hex to 6-digit and ensures proper format.
 *
 * @param color - The color string to validate
 * @returns Normalized hex color (e.g., "#635BFF") or undefined if invalid
 */
export function normalizeHexColor(color: string): string | undefined {
    if (!color) {
        return undefined;
    }

    // Clean up the color string
    let hex = color.trim().toLowerCase();

    // Handle colors without #
    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    // Validate format
    if (!/^#[0-9a-f]{3,8}$/i.test(hex)) {
        return undefined;
    }

    // Convert 3-digit to 6-digit
    if (hex.length === 4) {
        hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }

    // Only accept 6-digit hex (ignore alpha)
    if (hex.length === 7) {
        return hex.toUpperCase();
    }

    // 8-digit hex (with alpha) - strip alpha
    if (hex.length === 9) {
        return hex.slice(0, 7).toUpperCase();
    }

    return undefined;
}

/**
 * Converts RGB color to hex format.
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hex color string (e.g., "#635BFF")
 */
export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number): string => {
        const clamped = Math.max(0, Math.min(255, Math.round(n)));
        return clamped.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Parses a CSS color value to hex format.
 * Supports hex (#xxx, #xxxxxx), rgb(), and rgba() formats.
 *
 * @param color - The CSS color string
 * @returns Hex color string or undefined if invalid/unsupported
 */
export function parseCssColor(color: string): string | undefined {
    if (!color) {
        return undefined;
    }

    const trimmed = color.trim().toLowerCase();

    // Hex format
    if (trimmed.startsWith("#")) {
        return normalizeHexColor(trimmed);
    }

    // RGB format: rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = trimmed.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1]!, 10);
        const g = parseInt(rgbMatch[2]!, 10);
        const b = parseInt(rgbMatch[3]!, 10);
        return rgbToHex(r, g, b);
    }

    return undefined;
}

/**
 * Determines if a color is "light" (should use dark text) or "dark" (should use light text).
 * Uses relative luminance calculation.
 *
 * @param hexColor - Hex color string (e.g., "#635BFF")
 * @returns true if the color is light (luminance > 0.5), false otherwise
 */
export function isLightColor(hexColor: string): boolean {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    // Calculate relative luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    return luminance > 0.5;
}

/**
 * Generates a lighter variant of a color for dark mode.
 * Increases lightness while preserving hue.
 *
 * @param hexColor - The base hex color
 * @param amount - Amount to lighten (0-1, default 0.2)
 * @returns Lightened hex color
 */
export function lightenColor(hexColor: string, amount: number = 0.2): string {
    const hex = hexColor.replace("#", "");
    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);

    // Simple lightening: move each component toward 255
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);

    return rgbToHex(r, g, b);
}

/**
 * Extracts accent color from HTML content.
 * Looks for colors in priority order:
 * 1. <meta name="theme-color" content="..."> (most reliable)
 * 2. <meta name="msapplication-TileColor" content="...">
 * 3. JSON color config: "colors":{"primary":"#..."} or "primary":"#..."
 * 4. CSS variables: --primary, --accent, --brand in <style> blocks
 * 5. Common button colors in inline styles
 *
 * @param html - The HTML content to search
 * @returns AccentColor object with extracted colors, or undefined if none found
 */
export function extractAccentColor(html: string): AccentColor | undefined {
    const colors: { value: string; priority: number; isDark?: boolean }[] = [];

    // Pattern 1: <meta name="theme-color"> (highest priority)
    const themeColorRegex =
        /<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/gi;
    let match: RegExpExecArray | null;

    while ((match = themeColorRegex.exec(html)) !== null) {
        const colorValue = match[1] ?? match[2];
        if (colorValue) {
            const hex = parseCssColor(colorValue);
            if (hex) {
                // Check for media query context (dark mode)
                const context = match[0].toLowerCase();
                const isDark = context.includes("dark") || context.includes("prefers-color-scheme");
                colors.push({ value: hex, priority: 1, isDark: isDark ? true : undefined });
            }
        }
    }

    // Pattern 1b: <meta name="msapplication-TileColor">
    const tileColorRegex =
        /<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*name=["']msapplication-TileColor["']/gi;

    while ((match = tileColorRegex.exec(html)) !== null) {
        const colorValue = match[1] ?? match[2];
        if (colorValue) {
            const hex = parseCssColor(colorValue);
            if (hex && !colors.some((c) => c.value === hex)) {
                colors.push({ value: hex, priority: 1 });
            }
        }
    }

    // Pattern 2: JSON color config
    // Matches: "colors":{"primary":"#16A34A","light":"#07C983","dark":"#15803D"}
    // Also matches escaped JSON: \"colors\":{\"primary\":\"#16A34A\"...}
    const jsonColorsRegex = /"colors"\s*:\s*\{\s*"primary"\s*:\s*"(#[a-fA-F0-9]{3,8})"/gi;
    const jsonColorsEscapedRegex = /\\"colors\\"\s*:\s*\{\s*\\"primary\\"\s*:\s*\\"(#[a-fA-F0-9]{3,8})\\"/gi;
    const jsonLightColorRegex = /"light"\s*:\s*"(#[a-fA-F0-9]{3,8})"/gi;
    const jsonDarkColorRegex = /"dark"\s*:\s*"(#[a-fA-F0-9]{3,8})"/gi;

    // Extract primary color from JSON
    while ((match = jsonColorsRegex.exec(html)) !== null) {
        const colorValue = match[1];
        if (colorValue) {
            const hex = normalizeHexColor(colorValue);
            if (hex && !colors.some((c) => c.value === hex)) {
                colors.push({ value: hex, priority: 1 });
            }
        }
    }

    // Also try escaped JSON (Next.js RSC payloads)
    while ((match = jsonColorsEscapedRegex.exec(html)) !== null) {
        const colorValue = match[1];
        if (colorValue) {
            const hex = normalizeHexColor(colorValue);
            if (hex && !colors.some((c) => c.value === hex)) {
                colors.push({ value: hex, priority: 1 });
            }
        }
    }

    // Extract light/dark variants from JSON if primary was found
    if (colors.length > 0) {
        // Look for light variant
        while ((match = jsonLightColorRegex.exec(html)) !== null) {
            const colorValue = match[1];
            if (colorValue) {
                const hex = normalizeHexColor(colorValue);
                if (hex && !colors.some((c) => c.value === hex && c.isDark === false)) {
                    colors.push({ value: hex, priority: 1, isDark: false });
                }
            }
        }

        // Look for dark variant
        while ((match = jsonDarkColorRegex.exec(html)) !== null) {
            const colorValue = match[1];
            if (colorValue) {
                const hex = normalizeHexColor(colorValue);
                if (hex && !colors.some((c) => c.value === hex && c.isDark === true)) {
                    colors.push({ value: hex, priority: 1, isDark: true });
                }
            }
        }
    }

    // Pattern 3: CSS variables in <style> blocks
    const styleBlockRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    // Match color values including hex, rgb(), rgba() - capture until ; or }
    const cssVarPatterns = [
        /--(?:primary|accent|brand)(?:-color)?:\s*([^;}\n]+)/gi,
        /--(?:color-primary|color-accent|color-brand):\s*([^;}\n]+)/gi,
        /--(?:theme-primary|theme-accent):\s*([^;}\n]+)/gi
    ];

    while ((match = styleBlockRegex.exec(html)) !== null) {
        const styleContent = match[1] ?? "";

        for (const pattern of cssVarPatterns) {
            pattern.lastIndex = 0; // Reset regex state
            let varMatch: RegExpExecArray | null;
            while ((varMatch = pattern.exec(styleContent)) !== null) {
                const colorValue = varMatch[1];
                if (colorValue) {
                    const hex = parseCssColor(colorValue);
                    if (hex) {
                        // Check if this is in a dark mode context
                        const beforeMatch = styleContent.slice(0, varMatch.index);
                        const lastMediaQuery = beforeMatch.lastIndexOf("@media");
                        const isDark =
                            lastMediaQuery !== -1 &&
                            beforeMatch.slice(lastMediaQuery).includes("prefers-color-scheme: dark");

                        colors.push({ value: hex, priority: 2, isDark: isDark ? true : undefined });
                    }
                }
            }
        }
    }

    // Pattern 4: Look for accent colors in button/link styles (lower priority)
    const buttonColorRegex =
        /(?:\.btn|\.button|a\.cta|\.primary)[^{]*\{[^}]*(?:background(?:-color)?|border-color):\s*([^;}\n]+)/gi;
    while ((match = buttonColorRegex.exec(html)) !== null) {
        const colorValue = match[1];
        if (colorValue) {
            const hex = parseCssColor(colorValue);
            if (hex && !colors.some((c) => c.value === hex)) {
                colors.push({ value: hex, priority: 3 });
            }
        }
    }

    // No colors found
    if (colors.length === 0) {
        return undefined;
    }

    // Sort by priority
    colors.sort((a, b) => a.priority - b.priority);

    // Build the AccentColor object
    const result: AccentColor = {};

    // Find light and dark variants
    const darkColor = colors.find((c) => c.isDark === true);
    const lightColor = colors.find((c) => c.isDark !== true);

    if (lightColor) {
        result.light = lightColor.value;

        // If we have explicit dark color, use it; otherwise generate one
        if (darkColor) {
            result.dark = darkColor.value;
        } else {
            // Generate a lighter variant for dark mode
            result.dark = lightenColor(lightColor.value, 0.25);
        }
    } else if (darkColor) {
        // Only dark color found
        result.dark = darkColor.value;
        result.light = darkColor.value;
    }

    return result.light || result.dark ? result : undefined;
}

// ============================================================================
// Main Branding Extraction
// Combines logo, favicon, and color extraction.
// ============================================================================

/**
 * Extracts site branding (logo, favicon, accent color) from HTML content.
 *
 * @param html - The HTML content to search (typically the root/home page)
 * @param baseUrl - The base URL for resolving relative URLs
 * @returns SiteBranding object with extracted branding elements
 */
export function extractBranding(html: string, baseUrl: string): SiteBranding {
    const branding: SiteBranding = {};

    // Extract logo
    const logo = extractLogo(html, baseUrl);
    if (logo) {
        branding.logo = logo;
    }

    // Extract favicon
    const favicon = extractFavicon(html, baseUrl);
    if (favicon) {
        branding.favicon = favicon;
    }

    // Extract accent color
    const accentColor = extractAccentColor(html);
    if (accentColor) {
        branding.accentColor = accentColor;
    }

    return branding;
}

/**
 * Downloads an image from a URL and returns it as a buffer.
 * Used to download logo/favicon images for local storage.
 *
 * @param url - The URL of the image to download
 * @returns Promise resolving to the image buffer, or undefined on failure
 */
export async function downloadImage(url: string): Promise<Buffer | undefined> {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "site-to-docs/1.0",
                Accept: "image/*"
            }
        });

        if (!response.ok) {
            return undefined;
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch {
        return undefined;
    }
}

/**
 * Extracts the file extension from a URL.
 *
 * @param url - The URL to extract extension from
 * @returns File extension (e.g., "svg", "png") or "png" as default
 */
export function getExtensionFromUrl(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const ext = pathname.split(".").pop()?.toLowerCase();
        if (ext && ["svg", "png", "jpg", "jpeg", "gif", "ico", "webp"].includes(ext)) {
            return ext;
        }
    } catch {
        // Ignore URL parsing errors
    }
    return "png"; // Default extension
}
