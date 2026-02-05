import { type ArrayOf12, arrayOf12, type ColorPalette, FERN_COLOR_ACCENT } from "@fern-api/docs-utils";
import * as RadixColors from "@radix-ui/colors";
import Color from "colorjs.io";

import { darkGrayColors, generateRadixColors, lightGrayColors, toOklchString } from "./generateRadixColors";

/**
 * the goal is to determine the closest grayscale color for the given background and accent
 * this is used to determine which color to match against the grayscale color palettes
 */
export function getSourceForGrayscale({ background, accent }: { background?: string; accent?: string }): string {
    const shouldUseAccentColor = accent != null && (!background || isWhiteOrBlack(background));

    return (shouldUseAccentColor ? accent : background) ?? RadixColors.gray.gray12;
}

/**
 * @internal visible for testing
 */
export function isWhiteOrBlack(colorString: string): boolean {
    const color = new Color(colorString);
    color.alpha = 1;
    return ["#fff", "#000", "#ffffff", "#000000"].includes(color.to("srgb").toString({ format: "hex" }).toLowerCase());
}

type GrayScale = keyof typeof lightGrayColors | keyof typeof darkGrayColors;

/**
 * @internal visible for testing
 */
export function getClosestGrayColor(source: string): GrayScale {
    try {
        const sourceColor = new Color(source).to("oklch");
        const allColors: { scale: string; color: Color; distance: number }[] = [];

        [...Object.entries(lightGrayColors), ...Object.entries(darkGrayColors)].forEach(([name, scale]) => {
            for (const color of scale) {
                const distance = sourceColor.deltaE76(color);
                allColors.push({ scale: name, distance, color });
            }
        });

        allColors.sort((a, b) => a.distance - b.distance);

        const closestColor = allColors[0];
        if (!closestColor) {
            throw new Error("No closest color found");
        }
        return closestColor.scale as GrayScale;
    } catch (e) {
        console.error(`[generate-fern-colors] ${JSON.stringify(e)}`);
        return "gray";
    }
}

function generateColorPalette(opts: {
    appearance: "light" | "dark";
    accent: string;
    background?: string;
}): ColorPalette {
    const source = getSourceForGrayscale(opts);
    const gray = getClosestGrayColor(source);
    const accent = opts.accent;
    const background = opts.background ?? (opts.appearance === "light" ? "#ffffff" : "#000000");
    const grayScale = Object.values(
        RadixColors[opts.appearance === "light" ? gray : (`${gray}Dark` as const)]
    ) as ArrayOf12<string>;
    const grayScaleAlpha = Object.values(
        RadixColors[opts.appearance === "light" ? (`${gray}A` as const) : (`${gray}DarkA` as const)]
    ) as ArrayOf12<string>;
    const grayScaleWideGamut = Object.values(
        RadixColors[opts.appearance === "light" ? (`${gray}P3` as const) : (`${gray}DarkP3` as const)]
    ) as ArrayOf12<string>;
    const grayScaleAlphaWideGamut = Object.values(
        RadixColors[opts.appearance === "light" ? (`${gray}A` as const) : (`${gray}DarkA` as const)]
    ) as ArrayOf12<string>;
    const palette = generateRadixColors({
        appearance: opts.appearance,
        accent,
        background,
        gray: grayScale[11]
    });
    return {
        ...palette,
        grayScale,
        grayScaleAlpha,
        grayScaleWideGamut,
        grayScaleAlphaWideGamut
    };
}

export interface AccentScaleOverrides {
    accent1?: string;
    accent2?: string;
    accent3?: string;
    accent4?: string;
    accent5?: string;
    accent6?: string;
    accent7?: string;
    accent8?: string;
    accent9?: string;
    accent10?: string;
    accent11?: string;
    accent12?: string;
}

export interface FernColorPalette extends Omit<ColorPalette, "background"> {
    border?: string;
    accent: string;
    sidebarBackground?: string;
    sidebarBackgroundTheme?: "light" | "dark";
    headerBackground?: string;
    headerBackgroundTheme?: "light" | "dark";
    cardBackground?: string;
    background?: string;
    themeColor: string;
}

export function generateFernColorPalette({
    appearance,
    background,
    // this is the default accent color (the fern logo color)
    accent = FERN_COLOR_ACCENT,
    border,
    sidebarBackground,
    headerBackground,
    cardBackground,
    accentScaleOverrides
}: {
    appearance: "light" | "dark";
    background?: string;
    accent?: string;
    border?: string;
    sidebarBackground?: string;
    headerBackground?: string;
    cardBackground?: string;
    accentScaleOverrides?: AccentScaleOverrides;
}): FernColorPalette {
    const palette = generateColorPalette({ appearance, background, accent });

    // Apply accent scale overrides if provided
    if (accentScaleOverrides) {
        const overrideArray = [
            accentScaleOverrides.accent1,
            accentScaleOverrides.accent2,
            accentScaleOverrides.accent3,
            accentScaleOverrides.accent4,
            accentScaleOverrides.accent5,
            accentScaleOverrides.accent6,
            accentScaleOverrides.accent7,
            accentScaleOverrides.accent8,
            accentScaleOverrides.accent9,
            accentScaleOverrides.accent10,
            accentScaleOverrides.accent11,
            accentScaleOverrides.accent12
        ];

        // Override individual accent scale colors if provided
        arrayOf12.forEach((i) => {
            const override = overrideArray[i];
            if (override != null) {
                const hexColor = toHex(override);
                palette.accentScale[i] = hexColor;
                // Also update wide gamut version
                try {
                    const color = new Color(override).to("oklch");
                    palette.accentScaleWideGamut[i] = toOklchString(color);
                } catch {
                    palette.accentScaleWideGamut[i] = hexColor;
                }
            }
        });
    }

    return {
        ...palette,
        accent,
        border,
        sidebarBackground,
        headerBackground,
        sidebarBackgroundTheme: sidebarBackground != null ? getTheme(sidebarBackground) : undefined,
        headerBackgroundTheme: headerBackground != null ? getTheme(headerBackground) : undefined,
        cardBackground,
        background,
        themeColor: toHex(background ?? accent)
    };
}

function toHex(color: string): string {
    return new Color(color).toString({ format: "hex" });
}

function getTheme(colorProp: string): "light" | "dark" {
    const color = new Color(colorProp);
    const lightness = color.to("oklch").l;
    return lightness < 0.5 ? "dark" : "light";
}
