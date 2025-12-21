import type { ProductSwitcherThemeConfig } from "@fern-api/docs-utils/types/theme-config";

export function buildProductSwitcherCss(
    theme: ProductSwitcherThemeConfig | undefined,
    options: {
        scopeSelector: string;
        lightSelector: string;
        darkSelector: string;
    }
): string {
    if (!theme || theme === "default") {
        return "";
    }

    if (theme === "toggle") {
        return `
/* Product Switcher Toggle Theme */
${options.scopeSelector} [data-product-switcher-theme="toggle"] .fern-product-selector {
  background-color: var(--grayscale-3);
  border-radius: 9999px;
  padding: 4px;
  gap: 4px;
  height: 36px;
  display: inline-flex;
  align-items: center;
}

${options.scopeSelector} [data-product-switcher-theme="toggle"] .fern-product-selector .product-dropdown-trigger {
  padding: 2px 16px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  background-color: transparent;
  color: var(--grayscale-11);
  cursor: pointer;
  transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
  white-space: nowrap;
  display: flex;
  align-items: center;
  text-decoration: none;
  height: 100%;
}

${options.scopeSelector} [data-product-switcher-theme="toggle"] .fern-product-selector .product-dropdown-trigger:hover {
  background-color: var(--grayscale-4);
}

${options.scopeSelector} [data-product-switcher-theme="toggle"] .fern-product-selector[data-state="open"] .product-dropdown-trigger,
${options.scopeSelector} [data-product-switcher-theme="toggle"] .fern-product-selector .product-dropdown-trigger[data-active="true"] {
  background-color: var(--background);
  color: var(--grayscale-12);
}

${options.scopeSelector} [data-product-switcher-theme="toggle"] .fern-product-selector .product-dropdown-trigger:focus-visible {
  outline: 2px solid var(--accent-9);
  outline-offset: 2px;
}

${options.darkSelector} [data-product-switcher-theme="toggle"] .fern-product-selector {
  background-color: var(--grayscale-4);
}

${options.darkSelector} [data-product-switcher-theme="toggle"] .fern-product-selector .product-dropdown-trigger:hover {
  background-color: var(--grayscale-5);
}

${options.darkSelector} [data-product-switcher-theme="toggle"] .fern-product-selector[data-state="open"] .product-dropdown-trigger,
${options.darkSelector} [data-product-switcher-theme="toggle"] .fern-product-selector .product-dropdown-trigger[data-active="true"] {
  background-color: var(--grayscale-6);
}
        `.trim();
    }

    return "";
}
