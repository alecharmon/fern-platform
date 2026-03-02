export type BodyThemeConfig = "canvas" | "default";

export type ProductSwitcherThemeConfig = "toggle" | "default";

export type TabsThemeConfig = "bubble" | "default";

export interface FernThemeConfig {
    body: BodyThemeConfig | undefined;
    tabs: TabsThemeConfig | undefined;
    productSwitcher: ProductSwitcherThemeConfig | undefined;
}
