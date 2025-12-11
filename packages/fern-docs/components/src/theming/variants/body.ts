import type { BodyThemeConfig } from "@fern-api/docs-utils/types/theme-config";

export function buildBodyCss(
    theme: BodyThemeConfig | undefined,
    options: {
        scopeSelector: string;
        lightSelector: string;
        darkSelector: string;
    }
): string {
    if (!theme || theme === "default") {
        return "";
    }

    if (theme === "canvas") {
        return `
/* Canvas Body Theme */
${options.scopeSelector} [data-body-theme="canvas"] .canvas-wrapper {
  display: flex;
  width: 100%;
  overflow: auto;
  height: 100%;
  border-radius: 16px 16px 16px 16px;
  justify-content: center;
  align-items: flex-start;
  margin-right: 12px;
  margin-bottom: 12px;
  height: calc(100vh - var(--header-height-real) - 12px);
  border: 1px solid var(--border);
  background-color: var(--card-background);
}

${options.scopeSelector} [data-body-theme="canvas"] body {
  overflow: hidden;
}

${options.scopeSelector} [data-body-theme="canvas"] #fern-toc {
  position: sticky;
  max-height: calc(100vh - var(--header-height-real) - 12px);
  overflow-y: auto;
  overflow-x: hidden;
  top: 0;
}

${options.scopeSelector} [data-body-theme="canvas"] #fern-toc:has(> *) {
  margin-right: 12px;
}

${options.scopeSelector} [data-body-theme="canvas"] .fern-layout-guide,
${options.scopeSelector} [data-body-theme="canvas"] .fern-layout-overview,
${options.scopeSelector} [data-body-theme="canvas"] .fern-layout-reference {
  width: 100%;
  border: none;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  position: relative;
}
        `.trim();
    }

    return "";
}
