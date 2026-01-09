export interface StyleOptions {
    primaryColor?: string | null;
    headingsFont?: string;
    bodyFont?: string;
    codeFont?: string;
    logoUrl?: string | null;
    companyName?: string | null;
}

/**
 * Converts a hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1]!, 16),
              g: parseInt(result[2]!, 16),
              b: parseInt(result[3]!, 16)
          }
        : null;
}

/**
 * Generates a simplified accent color scale for preview purposes.
 * This approximates the Radix color system used by fern-docs.
 *
 * The scale goes from 1 (lightest) to 12 (darkest), with:
 * - 1-4: Very light tints (for backgrounds)
 * - 5-8: Medium tints (for borders, subtle elements)
 * - 9-10: Full/near-full color (for buttons, primary elements)
 * - 11-12: Dark shades (for text on light backgrounds)
 */
function generateAccentColorScale(hexColor: string): string {
    const rgb = hexToRgb(hexColor);
    if (!rgb) {
        return "";
    }

    const { r, g, b } = rgb;

    // Generate solid color scale (lighter to darker)
    // These are approximations - the real Radix system is more sophisticated
    const solidScale = [
        `color-mix(in srgb, ${hexColor} 5%, white)`, // 1 - very light
        `color-mix(in srgb, ${hexColor} 10%, white)`, // 2
        `color-mix(in srgb, ${hexColor} 15%, white)`, // 3
        `color-mix(in srgb, ${hexColor} 25%, white)`, // 4
        `color-mix(in srgb, ${hexColor} 35%, white)`, // 5
        `color-mix(in srgb, ${hexColor} 50%, white)`, // 6
        `color-mix(in srgb, ${hexColor} 65%, white)`, // 7
        `color-mix(in srgb, ${hexColor} 80%, white)`, // 8
        hexColor, // 9 - the base color
        `color-mix(in srgb, ${hexColor} 90%, black)`, // 10 - slightly darker
        `color-mix(in srgb, ${hexColor} 75%, black)`, // 11 - darker (for text)
        `color-mix(in srgb, ${hexColor} 60%, black)` // 12 - darkest
    ];

    // Generate alpha scale (transparent versions)
    // These use rgba for transparency
    const alphaScale = [
        `rgba(${r}, ${g}, ${b}, 0.02)`, // a1
        `rgba(${r}, ${g}, ${b}, 0.04)`, // a2
        `rgba(${r}, ${g}, ${b}, 0.08)`, // a3 - commonly used for backgrounds
        `rgba(${r}, ${g}, ${b}, 0.12)`, // a4
        `rgba(${r}, ${g}, ${b}, 0.18)`, // a5
        `rgba(${r}, ${g}, ${b}, 0.26)`, // a6
        `rgba(${r}, ${g}, ${b}, 0.38)`, // a7
        `rgba(${r}, ${g}, ${b}, 0.52)`, // a8
        `rgba(${r}, ${g}, ${b}, 0.75)`, // a9 - commonly used for buttons
        `rgba(${r}, ${g}, ${b}, 0.82)`, // a10
        `rgba(${r}, ${g}, ${b}, 0.92)`, // a11 - commonly used for text
        `rgba(${r}, ${g}, ${b}, 0.97)` // a12
    ];

    const cssVars: string[] = [];

    // Add solid scale
    solidScale.forEach((color, i) => {
        cssVars.push(`--accent-${i + 1}: ${color} !important;`);
    });

    // Add alpha scale
    alphaScale.forEach((color, i) => {
        cssVars.push(`--accent-a${i + 1}: ${color} !important;`);
    });

    // Add special variables
    cssVars.push(`--accent-contrast: white !important;`);
    cssVars.push(`--accent-surface: rgba(${r}, ${g}, ${b}, 0.05) !important;`);
    cssVars.push(`--accent-indicator: ${hexColor} !important;`);
    cssVars.push(`--accent-track: ${hexColor} !important;`);

    return cssVars.join("\n  ");
}

/**
 * Maps font names to their Google Fonts URL-friendly format.
 * Some fonts have different names in Google Fonts vs display names.
 */
const GOOGLE_FONTS_MAP: Record<string, string> = {
    Inter: "Inter",
    Roboto: "Roboto",
    "Open Sans": "Open+Sans",
    Lato: "Lato",
    Poppins: "Poppins",
    Montserrat: "Montserrat",
    Nunito: "Nunito",
    Raleway: "Raleway",
    "Work Sans": "Work+Sans",
    "Source Sans Pro": "Source+Sans+Pro",
    "PT Sans": "PT+Sans",
    Merriweather: "Merriweather",
    "JetBrains Mono": "JetBrains+Mono",
    "Fira Code": "Fira+Code",
    "Source Code Pro": "Source+Code+Pro",
    "IBM Plex Mono": "IBM+Plex+Mono",
    "Roboto Mono": "Roboto+Mono",
    "Ubuntu Mono": "Ubuntu+Mono"
};

/**
 * Builds a Google Fonts import link for the selected fonts.
 */
function buildGoogleFontsImport(options: StyleOptions): string {
    const fonts = [options.headingsFont, options.bodyFont, options.codeFont].filter(
        (f): f is string => Boolean(f) && f !== "" && f !== "default"
    );

    if (fonts.length === 0) {
        return "";
    }

    // Deduplicate fonts
    const uniqueFonts = [...new Set(fonts)];

    const familyParams = uniqueFonts
        .map((font) => {
            const googleName = GOOGLE_FONTS_MAP[font] || font.replace(/ /g, "+");
            // Include multiple weights for better typography
            return `family=${googleName}:wght@400;500;600;700`;
        })
        .join("&");

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${familyParams}&display=swap" rel="stylesheet">`;
}

/**
 * Injects custom CSS variables into HTML to override the default theme.
 * This allows live preview of color and font changes.
 */
export function injectCustomStyles(html: string, options: StyleOptions): string {
    const fontImports = buildGoogleFontsImport(options);

    // Build CSS variable overrides
    const cssRules: string[] = [];

    if (options.primaryColor) {
        // Set the base accent color
        cssRules.push(`--accent: ${options.primaryColor} !important;`);
        // Generate and add the full color scale for proper theming
        const colorScale = generateAccentColorScale(options.primaryColor);
        if (colorScale) {
            cssRules.push(colorScale);
        }
    }

    if (options.headingsFont && options.headingsFont !== "default") {
        cssRules.push(`--font-heading: "${options.headingsFont}", sans-serif !important;`);
    }

    if (options.bodyFont && options.bodyFont !== "default") {
        cssRules.push(`--font-body: "${options.bodyFont}", sans-serif !important;`);
    }

    if (options.codeFont && options.codeFont !== "default") {
        cssRules.push(`--font-code: "${options.codeFont}", monospace !important;`);
    }

    // Only inject if there are actual customizations
    if (cssRules.length === 0 && !fontImports && !options.companyName && !options.logoUrl) {
        return html;
    }

    const styleBlock =
        cssRules.length > 0
            ? `<style id="preview-overrides">
:root, .light, .dark {
  ${cssRules.join("\n  ")}
}
</style>`
            : "";

    // Script to force layout recalculation after fonts load
    const fontLoadScript = fontImports
        ? `<script>
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function() {
    // Force a hard reflow after fonts load
    var body = document.body;
    var display = body.style.display;
    body.style.display = 'none';
    body.offsetHeight; // Force reflow
    body.style.display = display || '';
    // Also trigger resize event in case any JS listeners need it
    window.dispatchEvent(new Event('resize'));
  });
}
</script>`
        : "";

    const injectedContent = `${fontImports}
${styleBlock}`;

    // Insert styles before </head>
    let result = html;
    if (result.includes("</head>")) {
        result = result.replace("</head>", `${injectedContent}</head>`);
    } else if (result.includes("</HEAD>")) {
        result = result.replace("</HEAD>", `${injectedContent}</HEAD>`);
    } else {
        result = result + injectedContent;
    }

    // Insert font load script before </body>
    if (fontLoadScript) {
        if (result.includes("</body>")) {
            result = result.replace("</body>", `${fontLoadScript}</body>`);
        } else if (result.includes("</BODY>")) {
            result = result.replace("</BODY>", `${fontLoadScript}</BODY>`);
        }
    }

    // Replace "Fern" with company name
    if (options.companyName) {
        result = result.replace(/(?<![a-z.])Fern(?![a-z])/g, options.companyName);
    }

    // Replace logo using CSS content property
    if (options.logoUrl) {
        const logoOverrideStyle = `<style id="logo-override">
/* Replace logo images with custom logo */
header img[src*="logo"],
nav img[src*="logo"],
[class*="logo"] img,
img[class*="logo"],
img[alt*="logo" i],
a[href="/"] img {
  content: url(${options.logoUrl}) !important;
  object-fit: contain !important;
}
</style>`;

        if (result.includes("</head>")) {
            result = result.replace("</head>", `${logoOverrideStyle}</head>`);
        }
    }

    return result;
}
