import { describe, expect, it } from "vitest";

import { findExistingKey, parseColorsFromYml, type ThemeColors, updateColorsInYml } from "./docs-yml-colors";

describe("docs-yml-colors", () => {
    describe("findExistingKey", () => {
        it("returns existing camelCase key", () => {
            const section = { accentPrimary: "#ff0000" };
            expect(findExistingKey(section, "accentPrimary")).toBe("accentPrimary");
        });

        it("returns existing kebab-case key", () => {
            const section = { "accent-primary": "#ff0000" };
            expect(findExistingKey(section, "accentPrimary")).toBe("accent-primary");
        });

        it("returns default key when not found", () => {
            const section = {};
            expect(findExistingKey(section, "accentPrimary")).toBe("accent-primary");
        });
    });

    describe("parseColorsFromYml", () => {
        it("parses color values from yml", () => {
            const yml = `colors:
  accentPrimary:
    dark: "#ff0000"
    light: "#00ff00"
  background:
    dark: "#111111"
    light: "#ffffff"
`;
            const colors = parseColorsFromYml(yml);
            expect(colors.accentPrimary.dark).toBe("#ff0000");
            expect(colors.accentPrimary.light).toBe("#00ff00");
            expect(colors.background.dark).toBe("#111111");
            expect(colors.background.light).toBe("#ffffff");
        });

        it("handles kebab-case keys", () => {
            const yml = `colors:
  accent-primary:
    dark: "#ff0000"
`;
            const colors = parseColorsFromYml(yml);
            expect(colors.accentPrimary.dark).toBe("#ff0000");
        });

        it("handles string color values", () => {
            const yml = `colors:
  background: "#333333"
`;
            const colors = parseColorsFromYml(yml);
            expect(colors.background.dark).toBe("#333333");
            expect(colors.background.light).toBe("#333333");
        });

        it("returns empty colors when no colors section", () => {
            const yml = `title: My Docs`;
            const colors = parseColorsFromYml(yml);
            expect(colors.accentPrimary.dark).toBeNull();
        });
    });

    describe("updateColorsInYml", () => {
        it("updates colors while preserving comments", () => {
            const yml = `# Site configuration
title: My Docs

# Theme colors
colors:
  accentPrimary:
    dark: "#ff0000"
    light: "#00ff00"

# Navigation
navigation:
  - page: Home
`;
            const newColors: ThemeColors = {
                accentPrimary: { dark: "#0000ff", light: "#00ffff" },
                background: { dark: null, light: null },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result = updateColorsInYml(yml, newColors);
            expect(result).toContain("# Site configuration");
            expect(result).toContain("# Theme colors");
            expect(result).toContain("# Navigation");
            expect(result).toContain("title: My Docs");
        });

        it("preserves inline comments when updating colors", () => {
            const yml = `title: My Docs # doc title
colors:
  accentPrimary: # primary brand color
    dark: "#ff0000"
    light: "#00ff00"
`;
            const newColors: ThemeColors = {
                accentPrimary: { dark: "#0000ff", light: "#00ffff" },
                background: { dark: null, light: null },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result = updateColorsInYml(yml, newColors);
            expect(result).toContain("# doc title");
        });

        it("preserves comments through multiple color updates", () => {
            const yml = `# yaml-language-server: $schema=https://schema.buildwithfern.dev/docs-yml.json

# Site branding
title: My Docs

# Color theme
colors:
  accentPrimary:
    dark: "#ff0000"
    light: "#00ff00"

# Page navigation
navigation:
  - page: Home
`;

            const colors1: ThemeColors = {
                accentPrimary: { dark: "#111111", light: "#222222" },
                background: { dark: null, light: null },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result1 = updateColorsInYml(yml, colors1);
            expect(result1).toContain("# Site branding");
            expect(result1).toContain("# Color theme");
            expect(result1).toContain("# Page navigation");

            const colors2: ThemeColors = {
                accentPrimary: { dark: "#333333", light: "#444444" },
                background: { dark: "#000000", light: "#ffffff" },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result2 = updateColorsInYml(result1, colors2);
            expect(result2).toContain("# Site branding");
            expect(result2).toContain("# Color theme");
            expect(result2).toContain("# Page navigation");
        });

        it("works when YAML has no colors section (first-time color setup)", () => {
            const yml = `title: My Docs
navigation:
  - page: Home
`;
            const newColors: ThemeColors = {
                accentPrimary: { dark: "#0000ff", light: "#00ffff" },
                background: { dark: null, light: null },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result = updateColorsInYml(yml, newColors);
            expect(result).toContain("title: My Docs");
            expect(result).toContain("accent-primary");
            expect(result).toContain("#0000ff");
            expect(result).toContain("#00ffff");
        });

        it("works when colors is a null placeholder (colors: with no value)", () => {
            const yml = `title: My Docs
colors:
navigation:
  - page: Home
`;
            const newColors: ThemeColors = {
                accentPrimary: { dark: null, light: null },
                background: { dark: "#111111", light: "#eeeeee" },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result = updateColorsInYml(yml, newColors);
            expect(result).toContain("title: My Docs");
            expect(result).toContain("background");
            expect(result).toContain("#111111");
            expect(result).toContain("#eeeeee");
        });

        it("preserves inline comments on dark/light value lines", () => {
            const yml = `colors:
  accentPrimary:
    dark: "#ff0000" # brand red
    light: "#00ff00" # brand green
`;
            const newColors: ThemeColors = {
                accentPrimary: { dark: "#0000ff", light: "#00ffff" },
                background: { dark: null, light: null },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result = updateColorsInYml(yml, newColors);
            expect(result).toContain("# brand red");
            expect(result).toContain("# brand green");
            expect(result).toContain("#0000ff");
            expect(result).toContain("#00ffff");
        });

        it("preserves block comments spanning multiple lines", () => {
            const yml = `# This is a multi-line
# block comment
# about the configuration
title: My Docs
colors:
  background:
    dark: "#000000"
    light: "#ffffff"
`;
            const newColors: ThemeColors = {
                accentPrimary: { dark: null, light: null },
                background: { dark: "#111111", light: "#eeeeee" },
                border: { dark: null, light: null },
                sidebarBackground: { dark: null, light: null },
                headerBackground: { dark: null, light: null },
                cardBackground: { dark: null, light: null }
            };

            const result = updateColorsInYml(yml, newColors);
            expect(result).toContain("# This is a multi-line");
            expect(result).toContain("# block comment");
            expect(result).toContain("# about the configuration");
        });
    });
});
