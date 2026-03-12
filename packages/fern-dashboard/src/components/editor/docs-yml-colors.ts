import { isMap, parseDocument } from "yaml";

export interface ThemeColors {
    accentPrimary: { dark: string | null; light: string | null };
    background: { dark: string | null; light: string | null };
    border: { dark: string | null; light: string | null };
    sidebarBackground: { dark: string | null; light: string | null };
    headerBackground: { dark: string | null; light: string | null };
    cardBackground: { dark: string | null; light: string | null };
}

export const EMPTY_THEME_COLORS: ThemeColors = {
    accentPrimary: { dark: null, light: null },
    background: { dark: null, light: null },
    border: { dark: null, light: null },
    sidebarBackground: { dark: null, light: null },
    headerBackground: { dark: null, light: null },
    cardBackground: { dark: null, light: null }
};

type ColorKeyVariant = { key: string; format: "camelCase" | "kebab-case" };

export const COLOR_KEY_VARIANTS: Record<string, ColorKeyVariant[]> = {
    accentPrimary: [
        { key: "accentPrimary", format: "camelCase" },
        { key: "accent-primary", format: "kebab-case" }
    ],
    background: [{ key: "background", format: "camelCase" }],
    border: [{ key: "border", format: "camelCase" }],
    sidebarBackground: [
        { key: "sidebarBackground", format: "camelCase" },
        { key: "sidebar-background", format: "kebab-case" }
    ],
    headerBackground: [
        { key: "headerBackground", format: "camelCase" },
        { key: "header-background", format: "kebab-case" }
    ],
    cardBackground: [
        { key: "cardBackground", format: "camelCase" },
        { key: "card-background", format: "kebab-case" }
    ]
};

export const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
    { key: "accentPrimary", label: "Accent-primary" },
    { key: "background", label: "Background" },
    { key: "headerBackground", label: "Header background" },
    { key: "border", label: "Border" },
    { key: "sidebarBackground", label: "Sidebar background" },
    { key: "cardBackground", label: "Card background" }
];

/** Maps ThemeColors keys to their CSS custom property names. */
export const CSS_VAR_MAP: { key: keyof ThemeColors; varName: string }[] = [
    { key: "accentPrimary", varName: "--accent" },
    { key: "background", varName: "--background" },
    { key: "border", varName: "--border" },
    { key: "sidebarBackground", varName: "--sidebar-background" },
    { key: "headerBackground", varName: "--header-background" },
    { key: "cardBackground", varName: "--card-background" }
];

export function findExistingKey(colorsSection: Record<string, unknown>, colorName: string): string {
    const variants = COLOR_KEY_VARIANTS[colorName];
    if (!variants) {
        return colorName;
    }
    for (const variant of variants) {
        if (variant.key in colorsSection) {
            return variant.key;
        }
    }
    const kebabVariant = variants.find((v) => v.format === "kebab-case");
    return kebabVariant?.key ?? variants[0]?.key ?? colorName;
}

function readColorValue(
    colorsSection: Record<string, unknown>,
    colorName: string
): { dark: string | null; light: string | null } {
    const variants = COLOR_KEY_VARIANTS[colorName];
    if (!variants) {
        return { dark: null, light: null };
    }
    for (const variant of variants) {
        const value = colorsSection[variant.key] as Record<string, string> | string | undefined;
        if (typeof value === "string") {
            return { dark: value, light: value };
        }
        if (value) {
            return { dark: value.dark ?? null, light: value.light ?? null };
        }
    }
    return { dark: null, light: null };
}

export function parseColorsFromYml(content: string): ThemeColors {
    const colors: ThemeColors = { ...EMPTY_THEME_COLORS };

    try {
        const doc = parseDocument(content);
        const parsed = doc.toJS() as Record<string, unknown>;
        const colorsSection = parsed?.colors as Record<string, unknown> | undefined;
        if (!colorsSection) {
            return colors;
        }

        for (const field of COLOR_FIELDS) {
            colors[field.key] = readColorValue(colorsSection, field.key);
        }
    } catch {
        // ignore parse errors
    }

    return colors;
}

export function updateColorsInYml(content: string, colors: ThemeColors): string {
    try {
        const doc = parseDocument(content);
        const parsed = doc.toJS() as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        const colorsSection = (parsed.colors ?? {}) as Record<string, unknown>;

        // Ensure the colors node is a valid mapping in the AST.
        // If it's a null Scalar (e.g. `colors:` with no value), delete it so setIn can create a proper mapping.
        const colorsNode = doc.get("colors", true);
        if (colorsNode != null && !isMap(colorsNode)) {
            doc.deleteIn(["colors"]);
        }

        for (const field of COLOR_FIELDS) {
            const colorValue = colors[field.key];
            if (colorValue.dark || colorValue.light) {
                const existingKey = findExistingKey(colorsSection, field.key);
                const alternateKeys =
                    COLOR_KEY_VARIANTS[field.key]?.filter((v) => v.key !== existingKey).map((v) => v.key) ?? [];
                for (const altKey of alternateKeys) {
                    if (doc.hasIn(["colors", altKey])) {
                        doc.deleteIn(["colors", altKey]);
                    }
                }
                // Use leaf-level setIn for individual dark/light values to preserve inline comments
                if (colorValue.dark) {
                    doc.setIn(["colors", existingKey, "dark"], colorValue.dark);
                } else {
                    if (doc.hasIn(["colors", existingKey, "dark"])) {
                        doc.deleteIn(["colors", existingKey, "dark"]);
                    }
                }
                if (colorValue.light) {
                    doc.setIn(["colors", existingKey, "light"], colorValue.light);
                } else {
                    if (doc.hasIn(["colors", existingKey, "light"])) {
                        doc.deleteIn(["colors", existingKey, "light"]);
                    }
                }
            }
        }

        return doc.toString({
            lineWidth: 0,
            defaultKeyType: "PLAIN",
            defaultStringType: "PLAIN"
        });
    } catch {
        return content;
    }
}

/**
 * Directly applies color overrides as inline CSS custom properties on the
 * #preview-container element. This bypasses React rendering and context
 * propagation entirely, providing instant visual feedback.
 */
export function applyColorOverridesToPreviewContainer(colors: ThemeColors): void {
    const el = document.getElementById("preview-container");
    if (!el) {
        return;
    }

    const isDark = document.documentElement.classList.contains("dark");

    for (const { key, varName } of CSS_VAR_MAP) {
        const value = isDark ? colors[key].dark : colors[key].light;
        if (value) {
            el.style.setProperty(varName, value);
        } else {
            el.style.removeProperty(varName);
        }
    }
}

export function findDocsYmlFilePath(getDocsYmlContent: (path: string) => string | null): string | null {
    const candidates = ["docs.yml", "docs.yaml"];
    for (const candidate of candidates) {
        if (getDocsYmlContent(candidate) != null) {
            return candidate;
        }
    }
    return null;
}
