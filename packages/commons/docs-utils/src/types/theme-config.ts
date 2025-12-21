export type BodyThemeConfig = "canvas" | "default";

export type ProductSwitcherThemeConfig = "toggle" | "default";

export interface FernThemeConfig {
    body: BodyThemeConfig | undefined;
    productSwitcher: ProductSwitcherThemeConfig | undefined;
}
