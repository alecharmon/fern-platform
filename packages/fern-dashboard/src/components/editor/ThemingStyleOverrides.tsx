"use client";

import { useNavigation } from "@fern-docs/components/navigation";
import { useMemo } from "react";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";
import { EMPTY_THEME_COLORS, findDocsYmlFilePath, parseColorsFromYml, type ThemeColors } from "./docs-yml-colors";

function buildCssRules(colors: ThemeColors): string[] {
    const lightVars: string[] = [];
    const darkVars: string[] = [];

    if (colors.accentPrimary.light) {
        lightVars.push(`--accent: ${colors.accentPrimary.light};`);
    }
    if (colors.accentPrimary.dark) {
        darkVars.push(`--accent: ${colors.accentPrimary.dark};`);
    }
    if (colors.background.light) {
        lightVars.push(`--background: ${colors.background.light};`);
    }
    if (colors.background.dark) {
        darkVars.push(`--background: ${colors.background.dark};`);
    }
    if (colors.border.light) {
        lightVars.push(`--border: ${colors.border.light};`);
    }
    if (colors.border.dark) {
        darkVars.push(`--border: ${colors.border.dark};`);
    }
    if (colors.sidebarBackground.light) {
        lightVars.push(`--sidebar-background: ${colors.sidebarBackground.light};`);
    }
    if (colors.sidebarBackground.dark) {
        darkVars.push(`--sidebar-background: ${colors.sidebarBackground.dark};`);
    }
    if (colors.headerBackground.light) {
        lightVars.push(`--header-background: ${colors.headerBackground.light};`);
    }
    if (colors.headerBackground.dark) {
        darkVars.push(`--header-background: ${colors.headerBackground.dark};`);
    }
    if (colors.cardBackground.light) {
        lightVars.push(`--card-background: ${colors.cardBackground.light};`);
    }
    if (colors.cardBackground.dark) {
        darkVars.push(`--card-background: ${colors.cardBackground.dark};`);
    }

    const cssRules: string[] = [];

    if (lightVars.length > 0) {
        cssRules.push(`.light #preview-container, :root #preview-container { ${lightVars.join(" ")} }`);
    }
    if (darkVars.length > 0) {
        cssRules.push(`.dark #preview-container { ${darkVars.join(" ")} }`);
    }

    return cssRules;
}

export function ThemingStyleOverrides() {
    const { colorOverrides } = useThemingPanel();
    const { getDocsYmlContent } = useNavigation();

    const docsYmlColors = useMemo(() => {
        const filePath = findDocsYmlFilePath(getDocsYmlContent);
        if (!filePath) {
            return EMPTY_THEME_COLORS;
        }
        const content = getDocsYmlContent(filePath);
        if (!content) {
            return EMPTY_THEME_COLORS;
        }
        return parseColorsFromYml(content);
    }, [getDocsYmlContent]);

    const colors = colorOverrides ?? docsYmlColors;

    const cssRules = buildCssRules(colors);

    if (cssRules.length === 0) {
        return null;
    }

    return <style>{cssRules.join("\n")}</style>;
}
