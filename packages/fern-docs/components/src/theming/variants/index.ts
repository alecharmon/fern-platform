import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { buildBodyCss } from "./body";
import { buildProductSwitcherCss } from "./product-switcher";

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
    const productSwitcherCss = buildProductSwitcherCss(theme?.productSwitcher, options);
    return [bodyCss, productSwitcherCss].filter(Boolean).join("\n\n");
}
