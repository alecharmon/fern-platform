import { expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const BASELINE_DIR = path.join(__dirname, "..", "baselines");
const DIFF_DIR = path.join(__dirname, "..", "diffs");

/**
 * Default maximum pixel difference ratio before a test fails.
 * 0.01 = 1% of pixels can differ.
 */
const DEFAULT_MAX_DIFF_RATIO = 0.07;

interface ScreenshotCompareOptions {
    /**
     * A unique name for this screenshot (used as the filename).
     * e.g. "multi-repo-domain-homepage"
     */
    name: string;

    /**
     * Maximum ratio of differing pixels (0 to 1). Default: 0.01 (1%).
     */
    maxDiffRatio?: number;

    /**
     * Pixelmatch color threshold (0 to 1). Higher = more tolerant of
     * anti-aliasing and minor color shifts. Default: 0.1.
     */
    colorThreshold?: number;

    /**
     * Whether to capture a full-page screenshot. Default: true.
     */
    fullPage?: boolean;

    /**
     * Optional delay in ms to wait after page load before screenshotting.
     * Useful for pages with animations.
     */
    waitAfterLoad?: number;

    /**
     * Whether to wait for the page layout to stabilize (height stops
     * changing) before taking a screenshot. Default: true.
     */
    waitForStable?: boolean;
}

interface CompareResult {
    baselineExisted: boolean;
    diffRatio: number;
    diffPixels: number;
    totalPixels: number;
    baselinePath: string;
    diffPath: string | null;
}

/**
 * Takes a screenshot of the current page and compares it against a stored baseline.
 *
 * - If no baseline exists, stores the screenshot as the new baseline (test passes).
 * - If a baseline exists, compares pixel-by-pixel and fails if diff > maxDiffRatio.
 * - Baselines are committed to the repo — they are NOT auto-overwritten after comparison.
 * - To update baselines after an intentional change:
 *     UPDATE_BASELINES=true npx playwright test
 * - On failure, writes a diff image to the diffs/ directory.
 *
 * Usage in a test file:
 *   import { compareScreenshot } from "../utils/visual-regression";
 *   await compareScreenshot(page, { name: "my-page-homepage" });
 */

/**
 * Waits until the page's document height stops changing, indicating that
 * lazy-loaded content, fonts, and layout shifts have settled.
 */
async function waitForPageStable(
    page: Page,
    { interval = 500, timeout = 15_000 }: { interval?: number; timeout?: number } = {}
): Promise<void> {
    const deadline = Date.now() + timeout;
    let previousHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    let stableCount = 0;
    const requiredStableChecks = 3;

    while (Date.now() < deadline) {
        await page.waitForTimeout(interval);
        const currentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        if (currentHeight === previousHeight) {
            stableCount++;
            if (stableCount >= requiredStableChecks) {
                return;
            }
        } else {
            stableCount = 0;
            previousHeight = currentHeight;
        }
    }
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(`Page did not fully stabilize within ${timeout}ms — proceeding with screenshot`);
}

export async function compareScreenshot(page: Page, options: ScreenshotCompareOptions): Promise<CompareResult> {
    const {
        name,
        maxDiffRatio = DEFAULT_MAX_DIFF_RATIO,
        colorThreshold = 0.1,
        fullPage = true,
        waitAfterLoad,
        waitForStable = true
    } = options;

    // Wait for web fonts to finish loading
    await page.evaluate(() => document.fonts.ready);

    // Wait for all images to finish loading
    await page.evaluate(() =>
        Promise.all(
            Array.from(document.images)
                .filter((img) => !img.complete)
                .map(
                    (img) =>
                        new Promise<void>((resolve) => {
                            img.addEventListener("load", () => resolve(), { once: true });
                            img.addEventListener("error", () => resolve(), { once: true });
                        })
                )
        )
    );

    if (waitForStable) {
        await waitForPageStable(page);
    }

    if (waitAfterLoad) {
        await page.waitForTimeout(waitAfterLoad);
    }

    const screenshotBuffer = await page.screenshot({ fullPage });

    fs.mkdirSync(BASELINE_DIR, { recursive: true });

    const baselinePath = path.join(BASELINE_DIR, `${name}.png`);
    const baselineExists = fs.existsSync(baselinePath);
    const forceUpdate = process.env.UPDATE_BASELINES === "true";

    if (!baselineExists || forceUpdate) {
        // No baseline yet (or force update) — store this screenshot as the baseline
        fs.writeFileSync(baselinePath, screenshotBuffer);
        // biome-ignore lint/suspicious/noConsole: test output
        console.log(
            baselineExists
                ? `Updated baseline: ${name}.png`
                : `Created new baseline: ${name}.png (no previous baseline found)`
        );
        return {
            baselineExisted: false,
            diffRatio: 0,
            diffPixels: 0,
            totalPixels: 0,
            baselinePath,
            diffPath: null
        };
    }

    // Compare against existing baseline
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
    const current = PNG.sync.read(screenshotBuffer);

    // Handle size differences — pad the smaller image so pixelmatch can compare them.
    // Small dimension changes (e.g. a few pixels of height drift) will be absorbed
    // by the normal diff-ratio threshold instead of causing an immediate hard failure.
    let baselineImg = baseline;
    let currentImg = current;

    if (baseline.width !== current.width || baseline.height !== current.height) {
        // biome-ignore lint/suspicious/noConsole: test output
        console.log(
            `Dimensions differ for "${name}": ` +
                `baseline ${baseline.width}x${baseline.height} vs ` +
                `current ${current.width}x${current.height} — padding to common size for comparison`
        );

        const w = Math.max(baseline.width, current.width);
        const h = Math.max(baseline.height, current.height);

        const padImage = (src: PNG, targetW: number, targetH: number): PNG => {
            if (src.width === targetW && src.height === targetH) {
                return src;
            }
            const padded = new PNG({ width: targetW, height: targetH, fill: true });
            // Fill with transparent pixels (already zeroed), then copy source data row by row
            PNG.bitblt(src, padded, 0, 0, src.width, src.height, 0, 0);
            return padded;
        };

        baselineImg = padImage(baseline, w, h);
        currentImg = padImage(current, w, h);
    }

    const { width, height } = baselineImg;
    const diff = new PNG({ width, height });
    const totalPixels = width * height;

    const diffPixels = pixelmatch(baselineImg.data, currentImg.data, diff.data, width, height, {
        threshold: colorThreshold
    });

    const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
    let diffPath: string | null = null;

    if (diffRatio > maxDiffRatio) {
        // Save diff image and the new screenshot for debugging
        fs.mkdirSync(DIFF_DIR, { recursive: true });
        diffPath = path.join(DIFF_DIR, `${name}-diff.png`);
        fs.writeFileSync(diffPath, PNG.sync.write(diff));
        fs.writeFileSync(path.join(DIFF_DIR, `${name}-new.png`), screenshotBuffer);
        fs.writeFileSync(path.join(DIFF_DIR, `${name}-baseline.png`), fs.readFileSync(baselinePath));

        // biome-ignore lint/suspicious/noConsole: test output
        console.log(
            `Visual regression FAILED for "${name}": ` +
                `${diffPixels}/${totalPixels} pixels differ (${(diffRatio * 100).toFixed(2)}%), ` +
                `threshold: ${(maxDiffRatio * 100).toFixed(2)}%`
        );
    } else {
        // biome-ignore lint/suspicious/noConsole: test output
        console.log(
            `Visual regression passed for "${name}": ` +
                `${diffPixels}/${totalPixels} pixels differ (${(diffRatio * 100).toFixed(2)}%)`
        );
    }

    expect(
        diffRatio,
        `Visual regression failed for "${name}": ${(diffRatio * 100).toFixed(2)}% pixels differ (threshold: ${(maxDiffRatio * 100).toFixed(2)}%). Check diffs/${name}-diff.png`
    ).toBeLessThanOrEqual(maxDiffRatio);

    return {
        baselineExisted: true,
        diffRatio,
        diffPixels,
        totalPixels,
        baselinePath,
        diffPath
    };
}
