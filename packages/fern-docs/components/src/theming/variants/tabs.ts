import type { TabsThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { getTabsStyle } from "@fern-api/docs-utils/types/theme-config";

export function buildTabsCss(
    theme: TabsThemeConfig | undefined,
    options: {
        scopeSelector: string;
        lightSelector: string;
        darkSelector: string;
    }
): string {
    const style = getTabsStyle(theme);
    if (!style || style === "default") {
        return "";
    }

    if (style === "bubble") {
        return `
/* Bubble Tabs Theme */
${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item]::after {
  display: none;
}

${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item] {
  position: relative;
  isolation: isolate;
  transition: color 0.15s ease-in-out;
}

${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item]::before {
  content: "";
  position: absolute;
  inset: 6px 0;
  border-radius: 9999px;
  z-index: -1;
  transition: background-color 0.15s ease-in-out;
}

${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="active"] {
  color: var(--accent-a11);
}

${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="active"]::before {
  background-color: var(--accent-a3);
}

${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="active"] > span {
  -webkit-text-stroke: 0.5px currentcolor;
}

${options.scopeSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="inactive"]:hover::before {
  background-color: var(--grayscale-a3);
}

${options.darkSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="active"] {
  color: var(--accent-a11);
}

${options.darkSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="active"]::before {
  background-color: var(--accent-a3);
}

${options.darkSelector} [data-tabs-theme="bubble"] #fern-header [data-radix-collection-item][data-state="inactive"]:hover::before {
  background-color: var(--grayscale-a3);
}
        `.trim();
    }

    return "";
}
