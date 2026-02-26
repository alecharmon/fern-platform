import { PutObjectCommand } from "@aws-sdk/client-s3";
import chromium from "@sparticuz/chromium";
import { NextResponse } from "next/server";
import { type Browser, type Page, chromium as playwrightChromium } from "playwright-core";
import sharp from "sharp";
import { setTimeout } from "timers/promises";

import { getS3Client } from "@/app/services/s3";
import { isProduction } from "@/utils/environment";

import type { MaybeErrorResponse } from "../../utils/MaybeErrorResponse";
import {
    getHomepageImagesS3BucketName,
    HOMEPAGE_SCREENSHOT_HEIGHT,
    HOMEPAGE_SCREENSHOT_WIDTH,
    IMAGE_FILETYPE
} from "../constants";
import { getS3KeyForHomepageScreenshot } from "../getS3KeyForHomepageScreenshot";
import type { Theme } from "../types";

const NAVIGATION_TIMEOUT_MS = 45_000;
const SCREENSHOT_RETRY_ATTEMPTS = 2;
const BROWSER_LAUNCH_RETRY_ATTEMPTS = 3;
const BROWSER_LAUNCH_RETRY_DELAY_MS = 1_000;

export default async function generateHomepageImages({ url }: { url: string }): Promise<MaybeErrorResponse> {
    let browser: Browser | undefined;

    try {
        browser = await launchBrowserWithRetry();

        const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`;

        // Process each theme in parallel with its own page instance.
        const themes: Theme[] = ["light", "dark"];
        const results = await Promise.allSettled(
            themes.map(async (theme) => {
                const page = await browser!.newPage({
                    viewport: {
                        width: HOMEPAGE_SCREENSHOT_WIDTH,
                        height: HOMEPAGE_SCREENSHOT_HEIGHT
                    },
                    deviceScaleFactor: 2
                });
                try {
                    await takeScreenshotAndWriteToAws({ page, url: urlWithProtocol, theme });
                } finally {
                    await page.close().catch(() => {});
                }
            })
        );

        const errors: string[] = [];
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result != null && result.status === "rejected") {
                const themeMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
                console.warn(`Screenshot failed for ${url} (${themes[i]} theme):`, themeMessage);
                errors.push(`${themes[i]}: ${themeMessage}`);
            }
        }

        if (errors.length === themes.length) {
            // All screenshots failed — return an error response
            console.error(`All homepage screenshots failed for ${url}:`, errors);
            return {
                errorResponse: NextResponse.json(
                    { error: `Failed to generate homepage images: ${errors.join("; ")}` },
                    { status: 500 }
                )
            };
        }

        if (errors.length > 0) {
            // Some screenshots failed — log but still return success since at least one worked
            console.warn(`Some homepage screenshots failed for ${url}:`, errors);
        }

        return { data: undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to generate homepage images for ${url}:`, message);
        return {
            errorResponse: NextResponse.json(
                { error: `Failed to generate homepage images: ${message}` },
                { status: 500 }
            )
        };
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.warn("Failed to close browser:", closeError);
            }
        }
    }
}

async function launchBrowserWithRetry(): Promise<Browser> {
    for (let attempt = 1; attempt <= BROWSER_LAUNCH_RETRY_ATTEMPTS; attempt++) {
        try {
            if (isProduction()) {
                return await playwrightChromium.launch({
                    args: chromium.args,
                    executablePath: await chromium.executablePath(),
                    headless: true,
                    chromiumSandbox: false
                });
            } else {
                return await playwrightChromium.launch({
                    headless: true
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isRetryable = message.includes("ETXTBSY") || message.includes("EAGAIN") || message.includes("EBUSY");

            if (isRetryable && attempt < BROWSER_LAUNCH_RETRY_ATTEMPTS) {
                console.warn(
                    `Browser launch attempt ${attempt}/${BROWSER_LAUNCH_RETRY_ATTEMPTS} failed (${message}), retrying...`
                );
                await setTimeout(BROWSER_LAUNCH_RETRY_DELAY_MS * attempt);
                continue;
            }

            throw error;
        }
    }

    throw new Error("Failed to launch browser after all retry attempts");
}

async function takeScreenshotAndWriteToAws({ page, url, theme }: { page: Page; url: string; theme: Theme }) {
    await page.emulateMedia({ colorScheme: theme });

    try {
        await page.goto(url.toString(), {
            waitUntil: "networkidle",
            timeout: NAVIGATION_TIMEOUT_MS
        });
    } catch (navError) {
        const message = navError instanceof Error ? navError.message : String(navError);
        console.warn(`Navigation failed for ${url} (${theme} theme): ${message}`);
        throw new Error(`Navigation failed for ${url}: ${message}`);
    }

    // wait for icons and images to load
    await setTimeout(3_000);

    const screenshotBuffer = await takeScreenshotWithRetry(page);

    // this must stay in sync with the IMAGE_FILETYPE constant
    const compressedScreenshotBuffer = await sharp(screenshotBuffer)[IMAGE_FILETYPE]({ quality: 50 }).toBuffer();

    await getS3Client().send(
        new PutObjectCommand({
            Bucket: getHomepageImagesS3BucketName(),
            Key: getS3KeyForHomepageScreenshot({ url, theme }),
            Body: compressedScreenshotBuffer,
            ContentType: `image/${IMAGE_FILETYPE}`,
            ACL: "private"
        })
    );
}

async function takeScreenshotWithRetry(page: Page): Promise<Buffer> {
    for (let attempt = 1; attempt <= SCREENSHOT_RETRY_ATTEMPTS; attempt++) {
        try {
            return await page.screenshot();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isRetryable = message.includes("Protocol error") || message.includes("Unable to capture screenshot");

            if (isRetryable && attempt < SCREENSHOT_RETRY_ATTEMPTS) {
                console.warn(
                    `Screenshot attempt ${attempt}/${SCREENSHOT_RETRY_ATTEMPTS} failed (${message}), retrying...`
                );
                await setTimeout(1_000);
                continue;
            }

            throw error;
        }
    }

    throw new Error("Failed to take screenshot after all retry attempts");
}
