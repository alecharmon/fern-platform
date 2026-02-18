import yaml from "js-yaml";

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
    return variants[0]?.key ?? colorName;
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
        const parsed = yaml.load(content) as Record<string, unknown>;
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
        const parsed = yaml.load(content) as Record<string, unknown>;
        if (!parsed) {
            return content;
        }

        const colorsSection = (parsed.colors ?? {}) as Record<string, unknown>;

        for (const field of COLOR_FIELDS) {
            const colorValue = colors[field.key];
            if (colorValue.dark || colorValue.light) {
                const existingKey = findExistingKey(colorsSection, field.key);
                const alternateKeys =
                    COLOR_KEY_VARIANTS[field.key]?.filter((v) => v.key !== existingKey).map((v) => v.key) ?? [];
                for (const altKey of alternateKeys) {
                    delete colorsSection[altKey];
                }
                colorsSection[existingKey] = {
                    ...(colorValue.dark ? { dark: colorValue.dark } : {}),
                    ...(colorValue.light ? { light: colorValue.light } : {})
                };
            }
        }

        parsed.colors = colorsSection;
        return yaml.dump(parsed, { lineWidth: -1, quotingType: '"', forceQuotes: false });
    } catch {
        return content;
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
