export type BodyThemeConfig = "canvas" | "default";

export type TabsThemeStyle = "default" | "bubble";

export interface TabsThemeObjectConfig {
    style?: TabsThemeStyle;
    alignment?: "LEFT" | "CENTER";
    placement?: "HEADER" | "SIDEBAR";
}

export type TabsThemeConfig = TabsThemeStyle | TabsThemeObjectConfig;

export type ProductSwitcherThemeConfig = "toggle" | "default";

export interface FernThemeConfig {
    body: BodyThemeConfig | undefined;
    tabs: TabsThemeConfig | undefined;
    productSwitcher: ProductSwitcherThemeConfig | undefined;
}

/** Extract the style string from a TabsThemeConfig (string or object form). */
export function getTabsStyle(tabs: TabsThemeConfig | undefined): TabsThemeStyle | undefined {
    if (tabs == null) {
        return undefined;
    }
    if (typeof tabs === "string") {
        return tabs;
    }
    return tabs.style;
}
