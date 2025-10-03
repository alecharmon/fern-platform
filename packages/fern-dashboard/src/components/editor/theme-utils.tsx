import type { Monaco } from "@monaco-editor/react";

// Get CSS custom property value at runtime
function getCSSCustomProperty(property: string, fallback: string): string {
    if (typeof window !== "undefined") {
        const root = document.documentElement;
        const value = getComputedStyle(root).getPropertyValue(property).trim();
        // Monaco doesn't support oklch colors, so we need to fallback to a default color
        if (value.startsWith("oklch")) {
            return fallback;
        }
        return value || fallback;
    }
    return fallback;
}

// Enhanced theme with blues and greens for better markdown readability
export function defineAppTheme(monaco: Monaco) {
    const primaryColor = getCSSCustomProperty("--primary", "green");
    const tealVariant = getCSSCustomProperty("--monaco-blue", "blue");
    const purpleVariant = getCSSCustomProperty("--monaco-purple", "purple");
    const textPrimaryColor = getCSSCustomProperty("--foreground", "#111111");
    const textMutedColor = getCSSCustomProperty("--muted-foreground", "#8B949E");
    const darkGreen = getCSSCustomProperty("--green-1200", "#17450a");

    monaco.editor.defineTheme("app-theme", {
        base: "vs",
        inherit: true,
        rules: [
            // Keywords and control structures
            { token: "keyword", foreground: tealVariant, fontStyle: "bold" },
            {
                token: "keyword.control",
                foreground: tealVariant,
                fontStyle: "bold"
            },

            // Adjusts hyperlinks
            { token: "string", foreground: purpleVariant },

            // HTML/XML tags - no bold styling
            { token: "tag", foreground: darkGreen, fontStyle: "bold" },

            // Comments - muted
            { token: "comment", foreground: textMutedColor, fontStyle: "italic" },

            // Special markdown elements
            { token: "list.bullet", foreground: primaryColor },
            { token: "list.number", foreground: primaryColor }
        ],
        colors: {
            // Keep all light theme colors, with enhanced selections and highlights
            "editor.selectionBackground": primaryColor + "20", // Blue with transparency
            "editor.selectionHighlightBackground": primaryColor + "15",
            "editorBracketMatch.background": primaryColor + "15",
            "editorBracketMatch.border": primaryColor + "80",

            // Enhanced find/replace highlighting
            "editor.findMatchBackground": primaryColor + "20",
            "editor.findMatchHighlightBackground": primaryColor + "15",

            // Improved line highlighting
            "editor.lineHighlightBackground": primaryColor + "10",

            // Better cursor and selection colors
            "editorCursor.foreground": primaryColor,
            "editor.selectionForeground": textPrimaryColor
        }
    });

    return "app-theme";
}
