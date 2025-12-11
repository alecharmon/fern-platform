import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { buildBodyCss } from "./body";

export function getThemeCss(
    theme: FernThemeConfig | undefined,
    options: {
        scopeSelector: string;
        lightSelector: string;
        darkSelector: string;
    }
): string {
    if (!theme) {
        return "";
    }

    const bodyCss = buildBodyCss(theme?.body, options);
    return bodyCss || "";
}
