import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { buildBodyCss } from "./body";
import { buildProductSwitcherCss } from "./product-switcher";
import { buildTabsCss } from "./tabs";

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
    const tabsCss = buildTabsCss(theme?.tabs, options);
    const productSwitcherCss = buildProductSwitcherCss(theme?.productSwitcher, options);
    return [bodyCss, tabsCss, productSwitcherCss].filter(Boolean).join("\n\n");
}
