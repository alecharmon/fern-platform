import type { FileData } from "./types/file-data";

export type RgbaColor = { r: number; g: number; b: number; a?: number };

export type ArrayOf12<T> = [T, T, T, T, T, T, T, T, T, T, T, T];
export const arrayOf12 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

// prettier-ignore
export const grayScaleNames = ["gray", "mauve", "slate", "sage", "olive", "sand"] as const;
export type GrayScaleName = (typeof grayScaleNames)[number];

// prettier-ignore
export const scaleNames = [
    ...grayScaleNames,
    "tomato",
    "red",
    "ruby",
    "crimson",
    "pink",
    "plum",
    "purple",
    "violet",
    "iris",
    "indigo",
    "blue",
    "cyan",
    "teal",
    "jade",
    "green",
    "grass",
    "brown",
    "orange",
    "sky",
    "mint",
    "lime",
    "yellow",
    "amber"
] as const;

export interface ColorPalette {
    appearance: "light" | "dark";

    accentScale: ArrayOf12<string>;
    accentScaleAlpha: ArrayOf12<string>;
    accentScaleWideGamut: ArrayOf12<string>;
    accentScaleAlphaWideGamut: ArrayOf12<string>;
    accentContrast: string;

    grayScale: ArrayOf12<string>;
    grayScaleAlpha: ArrayOf12<string>;
    grayScaleWideGamut: ArrayOf12<string>;
    grayScaleAlphaWideGamut: ArrayOf12<string>;

    graySurface: string;
    graySurfaceWideGamut: string;

    accentSurface: string;
    accentSurfaceWideGamut: string;

    background: string;
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

export interface FernColorTheme extends FernColorPalette {
    logo?: FileData;
    backgroundImage?: FileData;
    /**
     * If true, render a linear gradient in the background using the accent color
     */
    backgroundGradient: boolean;
}
