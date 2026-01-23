import { generateFernColorPalette } from "@fern-api/docs-server/generateFernColors";
import type { FernFonts } from "@fern-api/docs-server/generateFonts";
import { type ArrayOf12, FERN_COLOR_ACCENT, type FernColorTheme } from "@fern-api/docs-utils";
import type { FernLayoutConfig } from "@fern-api/docs-utils/types/layout-config";
import type { FernThemeConfig } from "@fern-api/docs-utils/types/theme-config";
import { scopeCss } from "./scope-css";
import { getThemeCss } from "./variants";

const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
const FONT_SANS =
    "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

// todo: remove domain-specific styling

export function GlobalStyles({
    domain,
    layout,
    light,
    dark,
    fonts,
    inlineCss = [],
    inlineCssScopeSelector,
    scopeSelector = ":root",
    lightSelector = ".light, :root",
    darkSelector = ".dark",
    theme
}: {
    domain: string;
    layout: FernLayoutConfig;
    light?: FernColorTheme;
    dark?: FernColorTheme;
    fonts: FernFonts;
    inlineCss?: string[];
    inlineCssScopeSelector?: string;
    scopeSelector?: string;
    lightSelector?: string;
    darkSelector?: string;
    theme?: FernThemeConfig;
}) {
    const root = light ?? dark;
    const hasTheme = !!light && !!dark;

    const themeCss = getThemeCss(theme, {
        scopeSelector,
        lightSelector,
        darkSelector
    });

    // Fallback dark theme when no dark theme is provided (white accent on black background)
    const fallbackDarkPalette = generateFernColorPalette({
        appearance: "dark",
        accent: "#ffffff",
        background: "#000000"
    });

    const fallbackDark = {
        ...fallbackDarkPalette,
        accentScale: dark?.accentScale ?? fallbackDarkPalette.accentScale,
        accentScaleAlpha: dark?.accentScaleAlpha ?? fallbackDarkPalette.accentScaleAlpha,
        accentScaleWideGamut: dark?.accentScaleWideGamut ?? fallbackDarkPalette.accentScaleWideGamut,
        accentScaleAlphaWideGamut: dark?.accentScaleAlphaWideGamut ?? fallbackDarkPalette.accentScaleAlphaWideGamut,
        accentContrast: dark?.accentContrast ?? fallbackDarkPalette.accentContrast,
        grayScale: dark?.grayScale ?? fallbackDarkPalette.grayScale,
        grayScaleAlpha: dark?.grayScaleAlpha ?? fallbackDarkPalette.grayScaleAlpha,
        grayScaleWideGamut: dark?.grayScaleWideGamut ?? fallbackDarkPalette.grayScaleWideGamut,
        grayScaleAlphaWideGamut: dark?.grayScaleAlphaWideGamut ?? fallbackDarkPalette.grayScaleAlphaWideGamut,
        graySurface: dark?.graySurface ?? fallbackDarkPalette.graySurface,
        graySurfaceWideGamut: dark?.graySurfaceWideGamut ?? fallbackDarkPalette.graySurfaceWideGamut,
        accentSurface: dark?.accentSurface ?? fallbackDarkPalette.accentSurface,
        accentSurfaceWideGamut: dark?.accentSurfaceWideGamut ?? fallbackDarkPalette.accentSurfaceWideGamut,
        background: dark?.background ?? fallbackDarkPalette.background
    };
    return (
        <style key="__fern-global-styles">
            {`
        ${fonts.fontFaces.join("\n")}

        :root {
          --header-height: ${layout.headerHeight}px;
          --header-height-real: ${layout.headerHeight}px;
          --mobile-header-height-real: ${Math.min(layout.headerHeight, 64)}px;
          --content-width: ${layout.contentWidth}px;
          --sidebar-width: ${layout.sidebarWidth}px;
          --page-width: ${layout.pageWidth != null ? `${layout.pageWidth}px` : "100vw"};
          --logo-height: ${layout.logoHeight}px;
          --font-body: ${createFontFamilyCss(fonts.bodyFont, FONT_SANS)};
          --font-heading: ${createFontFamilyCss(fonts.headingFont, createFontFamilyCss(fonts.bodyFont, FONT_SANS))};
          --font-code: ${createFontFamilyCss(fonts.codeFont, FONT_MONO)};
        }

        ${scopeSelector} {
         
          ${domain.includes("nominal") ? "--radius: 0px;" : ""}

          /* for backwards compatibility */
          --typography-body-font-family: var(--font-body);
          --typography-heading-font-family: var(--font-heading);
          --typography-code-font-family: var(--font-code);
        }

        ${
            root
                ? getColorScaleCss({
                      mode: hasTheme ? "light" : "none",
                      name: "accent",
                      scale: root.accentScale,
                      scaleWideGamut: root.accentScaleWideGamut,
                      scaleAlpha: root.accentScaleAlpha,
                      scaleAlphaWideGamut: root.accentScaleAlphaWideGamut,
                      contrast: root.accentContrast,
                      surface: root.accentSurface,
                      surfaceWideGamut: root.accentSurfaceWideGamut,
                      scopeSelector,
                      lightSelector,
                      darkSelector
                  })
                : ""
        }

        ${
            root
                ? getColorScaleCss({
                      mode: hasTheme ? "light" : "none",
                      name: "grayscale",
                      scale: root.grayScale,
                      scaleWideGamut: root.grayScaleWideGamut,
                      scaleAlpha: root.grayScaleAlpha,
                      scaleAlphaWideGamut: root.grayScaleAlphaWideGamut,
                      contrast: root.appearance === "light" ? "#000" : "#fff",
                      surface: root.graySurface,
                      surfaceWideGamut: root.graySurfaceWideGamut,
                      scopeSelector,
                      lightSelector,
                      darkSelector
                  })
                : ""
        }

        ${
            hasTheme && dark
                ? getColorScaleCss({
                      mode: "dark",
                      name: "accent",
                      scale: dark.accentScale,
                      scaleWideGamut: dark.accentScaleWideGamut,
                      scaleAlpha: dark.accentScaleAlpha,
                      scaleAlphaWideGamut: dark.accentScaleAlphaWideGamut,
                      contrast: dark.accentContrast,
                      surface: dark.accentSurface,
                      surfaceWideGamut: dark.accentSurfaceWideGamut,
                      scopeSelector,
                      lightSelector,
                      darkSelector
                  })
                : !hasTheme && !!light
                  ? getColorScaleCss({
                        mode: "dark",
                        name: "accent",
                        scale: fallbackDark.accentScale,
                        scaleWideGamut: fallbackDark.accentScaleWideGamut,
                        scaleAlpha: fallbackDark.accentScaleAlpha,
                        scaleAlphaWideGamut: fallbackDark.accentScaleAlphaWideGamut,
                        contrast: fallbackDark.accentContrast,
                        surface: fallbackDark.accentSurface,
                        surfaceWideGamut: fallbackDark.accentSurfaceWideGamut,
                        scopeSelector,
                        lightSelector,
                        darkSelector
                    })
                  : ""
        }

        ${
            hasTheme && dark
                ? getColorScaleCss({
                      mode: "dark",
                      name: "grayscale",
                      scale: dark.grayScale,
                      scaleWideGamut: dark.grayScaleWideGamut,
                      scaleAlpha: dark.grayScaleAlpha,
                      scaleAlphaWideGamut: dark.grayScaleAlphaWideGamut,
                      contrast: dark.appearance === "light" ? "#000" : "#fff",
                      surface: dark.graySurface,
                      surfaceWideGamut: dark.graySurfaceWideGamut,
                      scopeSelector,
                      lightSelector,
                      darkSelector
                  })
                : getColorScaleCss({
                      mode: "dark",
                      name: "grayscale",
                      scale: fallbackDark.grayScale,
                      scaleWideGamut: fallbackDark.grayScaleWideGamut,
                      scaleAlpha: fallbackDark.grayScaleAlpha,
                      scaleAlphaWideGamut: fallbackDark.grayScaleAlphaWideGamut,
                      contrast: "#fff",
                      surface: fallbackDark.graySurface,
                      surfaceWideGamut: fallbackDark.graySurfaceWideGamut,
                      scopeSelector,
                      lightSelector,
                      darkSelector
                  })
        }

        ${hasTheme ? lightSelector : scopeSelector} {
          --accent: ${root?.accent ?? FERN_COLOR_ACCENT};
          --background: ${root?.background ?? (light ? "#fff" : "#000")};
          --border: ${domain.includes("nominal") ? "#000" : (root?.border ?? "initial")};
          --sidebar-background: ${root?.sidebarBackground ?? "initial"};
          --header-background: ${root?.headerBackground ?? "color-mix(in srgb, var(--background), transparent 30%)"};
          --card-background: ${root?.cardBackground ?? "initial"};
          --theme-color: ${root?.themeColor};
        }

        ${
            hasTheme && dark
                ? `${darkSelector} {
          --accent: ${dark?.accent ?? FERN_COLOR_ACCENT};
          --background: ${dark.background ?? "#000"};
          --border: ${domain.includes("nominal") ? "#fff" : (dark.border ?? "initial")};
          --sidebar-background: ${dark.sidebarBackground ?? "initial"};
          --header-background: ${dark.headerBackground ?? "color-mix(in srgb, var(--background), transparent 30%)"};
          --card-background: ${dark.cardBackground ?? "initial"};
          --theme-color: ${dark.themeColor};
        }`
                : !hasTheme && !!light
                  ? `${darkSelector} {
          --background: ${fallbackDark.background};
          --accent: ${fallbackDark.accent};
        }`
                  : `${darkSelector} { --background: ${dark?.background ?? "#000"}; }`
        }

        ${
            root?.backgroundGradient || root?.backgroundImage
                ? `.fern-background-image {
          background-image: ${root?.backgroundImage?.src ? `url(${root?.backgroundImage?.src})` : light ? "linear-gradient(to bottom, color-mix(in srgb, var(--accent), var(--background) 90%) 0, var(--background) 100%)" : "linear-gradient(to bottom, var(--background) 0, color-mix(in srgb, var(--accent), var(--background) 90%) 100%)"};
        }`
                : ""
        }

      ${
          hasTheme && (light?.backgroundGradient || light?.backgroundImage)
              ? `${darkSelector} .fern-background-image {
          background-image: ${light?.backgroundImage?.src ? `url(${light?.backgroundImage?.src})` : "linear-gradient(to bottom, var(--background) 0, color-mix(in srgb, var(--accent), var(--background) 90%) 100%)"};
        }`
              : ""
      }

        ${fonts.additionalCss}

        ${themeCss}

        ${
            inlineCssScopeSelector
                ? scopeCss(inlineCss.join("\n"), {
                      scopeSelector: inlineCssScopeSelector.split(",")[0]?.trim() ?? inlineCssScopeSelector,
                      additionalScopeSelectors: inlineCssScopeSelector
                          .split(",")
                          .slice(1)
                          .map((s) => s.trim())
                          .filter(Boolean)
                  })
                : inlineCss.join("\n")
        } `}
        </style>
    );
}
const getColorScaleCss = ({
    mode,
    name,
    scale,
    scaleWideGamut,
    scaleAlpha,
    scaleAlphaWideGamut,
    contrast,
    surface,
    surfaceWideGamut,
    scopeSelector,
    lightSelector,
    darkSelector
}: {
    mode: "light" | "dark" | "none";
    name: string;
    scale: ArrayOf12<string>;
    scaleWideGamut: ArrayOf12<string>;
    scaleAlpha: ArrayOf12<string>;
    scaleAlphaWideGamut: ArrayOf12<string>;
    contrast: string;
    surface: string;
    surfaceWideGamut: string;
    scopeSelector?: string;
    lightSelector?: string;
    darkSelector?: string;
}) => {
    const selector = mode === "dark" ? darkSelector : mode === "light" ? lightSelector : scopeSelector;

    return `
${selector} {
  ${scale.map((value, index) => `--${name}-${index + 1}: ${value};`).join("\n  ")}

  ${scaleAlpha.map((value, index) => `--${name}-a${index + 1}: ${value};`).join("\n  ")}

  --${name}-contrast: ${contrast};
  --${name}-surface: ${surface};
  --${name}-indicator: ${scale[8]};
  --${name}-track: ${scale[8]};
}

@supports (color: color(display-p3 1 1 1)) {
  @media (color-gamut: p3) {
    ${selector} {
      ${scaleWideGamut.map((value, index) => `--${name}-${index + 1}: ${value};`).join("\n      ")}

      ${scaleAlphaWideGamut.map((value, index) => `--${name}-a${index + 1}: ${value};`).join("\n      ")}

      --${name}-contrast: ${contrast};
      --${name}-surface: ${surfaceWideGamut};
      --${name}-indicator: ${scaleWideGamut[8]};
      --${name}-track: ${scaleWideGamut[8]};
    }
  }
}
  `.trim();
};

function createFontFamilyCss(fontFamily: string | undefined, fallback: string) {
    return fontFamily ? `${fontFamily}, ${fallback}` : fallback;
}
