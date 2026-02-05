import { FERN_COLOR_ACCENT, FERN_COLOR_AIR, FERN_COLOR_GROUND } from "@fern-api/docs-utils";
import * as RadixColors from "@radix-ui/colors";
import { describe, expect, it, vi } from "vitest";

import {
    generateFernColorPalette,
    getClosestGrayColor,
    getSourceForGrayscale,
    isWhiteOrBlack
} from "./generateFernColors";

vi.mock("server-only", () => ({}));

describe("isWhiteOrBlack", () => {
    it("should return true for white", () => {
        expect(isWhiteOrBlack("#fff")).toBe(true);
        expect(isWhiteOrBlack("#ffffff")).toBe(true);
        expect(isWhiteOrBlack("#000")).toBe(true);
        expect(isWhiteOrBlack("#000000")).toBe(true);
        expect(isWhiteOrBlack("rgb(255, 255, 255)")).toBe(true);
        expect(isWhiteOrBlack("rgb(0, 0, 0)")).toBe(true);
        expect(isWhiteOrBlack("rgba(255, 255, 255, 1)")).toBe(true);
        expect(isWhiteOrBlack("rgba(0, 0, 0, 1)")).toBe(true);
        expect(isWhiteOrBlack("#000000FF")).toBe(true);
        expect(isWhiteOrBlack("#FFFFFFFF")).toBe(true);
        expect(isWhiteOrBlack("rgba(0, 0, 0, 0.5)")).toBe(true);
        expect(isWhiteOrBlack("rgba(255, 255, 255, 0.5)")).toBe(true);
        expect(isWhiteOrBlack("white")).toBe(true);
        expect(isWhiteOrBlack("black")).toBe(true);
        expect(isWhiteOrBlack("hsl(0, 0%, 100%)")).toBe(true);
        expect(isWhiteOrBlack("hsl(0, 0%, 0%)")).toBe(true);
    });

    it("should return false for other colors", () => {
        expect(isWhiteOrBlack("#999")).toBe(false);
        expect(isWhiteOrBlack("#aaa")).toBe(false);
        expect(isWhiteOrBlack("#eee")).toBe(false);
        expect(isWhiteOrBlack("#f0f0f0")).toBe(false);
        expect(isWhiteOrBlack("#ff0000")).toBe(false);
        expect(isWhiteOrBlack("rgb(200, 230, 255)")).toBe(false);
        expect(isWhiteOrBlack("rgb(100, 100, 100)")).toBe(false);
        expect(isWhiteOrBlack("rgba(255, 250, 255, 0.5)")).toBe(false);
        expect(isWhiteOrBlack("rgba(0, 0, 1, 0.5)")).toBe(false);
        expect(isWhiteOrBlack("hsl(0, 0%, 50%)")).toBe(false);
        expect(isWhiteOrBlack("hsl(0, 0%, 50%)")).toBe(false);
    });
});

describe("getSourceForGrayscale", () => {
    it("should return gray when colors isnt specified", () => {
        expect(getSourceForGrayscale({})).toBe(RadixColors.gray.gray12);
    });

    it("should return background when only background is specified", () => {
        expect(getSourceForGrayscale({ background: "#fff" })).toBe("#fff");
        expect(getSourceForGrayscale({ background: "#000" })).toBe("#000");
        expect(getSourceForGrayscale({ background: "#f0f0f0" })).toBe("#f0f0f0");
    });

    it("should return background when bg is colored", () => {
        expect(getSourceForGrayscale({ background: "#ff0000", accent: "#123" })).toBe("#ff0000");
        expect(getSourceForGrayscale({ background: "#eeeeee", accent: "#123" })).toBe("#eeeeee");
    });

    it("should return accent when bg is white or black", () => {
        expect(getSourceForGrayscale({ background: "#fff", accent: "#123" })).toBe("#123");
        expect(getSourceForGrayscale({ background: "#000", accent: "#123" })).toBe("#123");
    });

    it("should return accent when bg is not specified", () => {
        expect(getSourceForGrayscale({ accent: "#123" })).toBe("#123");
    });
});

describe("getClosestGrayColor", () => {
    it("should pick a grayscale that matches closely with the source color", () => {
        expect(getClosestGrayColor("#FFFAEA")).toMatchInlineSnapshot(`"olive"`);
        expect(getClosestGrayColor("#61F6B5")).toMatchInlineSnapshot(`"olive"`);
        expect(getClosestGrayColor("#0E0E12")).toMatchInlineSnapshot(`"slate"`);
        expect(getClosestGrayColor("#FAFCFA")).toMatchInlineSnapshot(`"sage"`);
        expect(getClosestGrayColor("#1EA32A")).toMatchInlineSnapshot(`"olive"`);
    });
});

describe("generateFernColorPalette", () => {
    it.skip("Should generate fern colors", () => {
        expect(
            generateFernColorPalette({
                appearance: "light",
                accent: FERN_COLOR_ACCENT,
                background: FERN_COLOR_AIR
            })
        ).toMatchSnapshot();
        expect(
            generateFernColorPalette({
                appearance: "dark",
                accent: FERN_COLOR_ACCENT,
                background: FERN_COLOR_GROUND
            })
        ).toMatchSnapshot();
    });
    it.skip("should generate vapi colors", () => {
        expect(
            generateFernColorPalette({
                appearance: "light",
                accent: "#61F6B5",
                background: "#FFFAEA"
            })
        ).toMatchSnapshot();
        expect(
            generateFernColorPalette({
                appearance: "dark",
                background: "#0E0E12",
                accent: "#61F6B5"
            })
        ).toMatchSnapshot();
    });
    it.skip("should generate humanloop colors", () => {
        expect(
            generateFernColorPalette({
                appearance: "light",
                background: "#FFF",
                accent: "#2A6A42"
            })
        ).toMatchSnapshot();
        expect(
            generateFernColorPalette({
                appearance: "dark",
                background: "#07110C",
                accent: "#2A6A42"
            })
        ).toMatchSnapshot();
    });

    describe("accent scale overrides", () => {
        it("should generate default accent scale colors when no overrides are provided", () => {
            const palette = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff"
            });

            // Verify accent scale has 12 colors
            expect(palette.accentScale).toHaveLength(12);
            expect(palette.accentScaleWideGamut).toHaveLength(12);

            // Verify all colors are generated (not undefined)
            palette.accentScale.forEach((color, index) => {
                expect(color).toBeDefined();
                expect(typeof color).toBe("string");
                expect(color.startsWith("#")).toBe(true);
            });
        });

        it("should override specific accent scale colors when overrides are provided", () => {
            const overrideColor1 = "#f0fdf4";
            const overrideColor5 = "#86efac";
            const overrideColor9 = "#16a34a";

            const palette = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff",
                accentScaleOverrides: {
                    accent1: overrideColor1,
                    accent5: overrideColor5,
                    accent9: overrideColor9
                }
            });

            // Verify overridden colors match exactly (converted to hex)
            expect(palette.accentScale[0].toLowerCase()).toBe(overrideColor1.toLowerCase());
            expect(palette.accentScale[4].toLowerCase()).toBe(overrideColor5.toLowerCase());
            expect(palette.accentScale[8].toLowerCase()).toBe(overrideColor9.toLowerCase());

            // Verify non-overridden colors are still generated (different from overrides)
            expect(palette.accentScale[1]).toBeDefined();
            expect(palette.accentScale[2]).toBeDefined();
            expect(palette.accentScale[3]).toBeDefined();
        });

        it("should override all 12 accent scale colors when all overrides are provided", () => {
            const overrides = {
                accent1: "#fef2f2",
                accent2: "#fee2e2",
                accent3: "#fecaca",
                accent4: "#fca5a5",
                accent5: "#f87171",
                accent6: "#ef4444",
                accent7: "#dc2626",
                accent8: "#b91c1c",
                accent9: "#991b1b",
                accent10: "#7f1d1d",
                accent11: "#6b1a1a",
                accent12: "#450a0a"
            };

            const palette = generateFernColorPalette({
                appearance: "dark",
                accent: "#418326",
                background: "#000000",
                accentScaleOverrides: overrides
            });

            // Verify all 12 colors are overridden
            expect(palette.accentScale[0].toLowerCase()).toBe(overrides.accent1.toLowerCase());
            expect(palette.accentScale[1].toLowerCase()).toBe(overrides.accent2.toLowerCase());
            expect(palette.accentScale[2].toLowerCase()).toBe(overrides.accent3.toLowerCase());
            expect(palette.accentScale[3].toLowerCase()).toBe(overrides.accent4.toLowerCase());
            expect(palette.accentScale[4].toLowerCase()).toBe(overrides.accent5.toLowerCase());
            expect(palette.accentScale[5].toLowerCase()).toBe(overrides.accent6.toLowerCase());
            expect(palette.accentScale[6].toLowerCase()).toBe(overrides.accent7.toLowerCase());
            expect(palette.accentScale[7].toLowerCase()).toBe(overrides.accent8.toLowerCase());
            expect(palette.accentScale[8].toLowerCase()).toBe(overrides.accent9.toLowerCase());
            expect(palette.accentScale[9].toLowerCase()).toBe(overrides.accent10.toLowerCase());
            expect(palette.accentScale[10].toLowerCase()).toBe(overrides.accent11.toLowerCase());
            expect(palette.accentScale[11].toLowerCase()).toBe(overrides.accent12.toLowerCase());
        });

        it("should also update wide gamut colors when overrides are provided", () => {
            const overrideColor = "#16a34a";

            const palette = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff",
                accentScaleOverrides: {
                    accent9: overrideColor
                }
            });

            // Verify wide gamut version is also updated (should be oklch format)
            expect(palette.accentScaleWideGamut[8]).toBeDefined();
            expect(palette.accentScaleWideGamut[8]).toContain("oklch");
        });

        it("should not modify palette when accentScaleOverrides is undefined", () => {
            const paletteWithoutOverrides = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff"
            });

            const paletteWithEmptyOverrides = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff",
                accentScaleOverrides: undefined
            });

            // Both palettes should have identical accent scales
            expect(paletteWithoutOverrides.accentScale).toEqual(paletteWithEmptyOverrides.accentScale);
        });

        it("should not modify non-overridden colors in the scale", () => {
            const paletteWithoutOverrides = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff"
            });

            const paletteWithPartialOverrides = generateFernColorPalette({
                appearance: "light",
                accent: "#418326",
                background: "#ffffff",
                accentScaleOverrides: {
                    accent5: "#ff0000"
                }
            });

            // Non-overridden colors should remain the same
            expect(paletteWithPartialOverrides.accentScale[0]).toBe(paletteWithoutOverrides.accentScale[0]);
            expect(paletteWithPartialOverrides.accentScale[1]).toBe(paletteWithoutOverrides.accentScale[1]);
            expect(paletteWithPartialOverrides.accentScale[2]).toBe(paletteWithoutOverrides.accentScale[2]);
            expect(paletteWithPartialOverrides.accentScale[3]).toBe(paletteWithoutOverrides.accentScale[3]);
            // accent5 (index 4) should be different
            expect(paletteWithPartialOverrides.accentScale[4]).not.toBe(paletteWithoutOverrides.accentScale[4]);
            // Rest should remain the same
            expect(paletteWithPartialOverrides.accentScale[5]).toBe(paletteWithoutOverrides.accentScale[5]);
            expect(paletteWithPartialOverrides.accentScale[6]).toBe(paletteWithoutOverrides.accentScale[6]);
        });
    });
});
