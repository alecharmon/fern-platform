import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import * as screenshotone from "screenshotone-api-sdk";

import { getS3Client } from "@/app/services/s3";

import type { MaybeErrorResponse } from "../../utils/MaybeErrorResponse";
import {
    getHomepageImagesS3BucketName,
    HOMEPAGE_SCREENSHOT_HEIGHT,
    HOMEPAGE_SCREENSHOT_WIDTH,
    IMAGE_FILETYPE
} from "../constants";
import { getS3KeyForHomepageScreenshot } from "../getS3KeyForHomepageScreenshot";
import type { Theme } from "../types";

const SCREENSHOT_ONE_TIMEOUT_S = 60;
const SCREENSHOT_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

function getScreenshotOneClient(): screenshotone.Client {
    const accessKey = process.env.SCREENSHOT_ONE_ACCESS_KEY;
    const secretKey = process.env.SCREENSHOT_ONE_SECRET_KEY;
    if (accessKey == null || secretKey == null) {
        throw new Error("SCREENSHOT_ONE_ACCESS_KEY and SCREENSHOT_ONE_SECRET_KEY must be defined in the environment");
    }
    return new screenshotone.Client(accessKey, secretKey);
}

function buildTakeOptions({ url, theme }: { url: string; theme: Theme }): screenshotone.TakeOptions {
    return screenshotone.TakeOptions.url(url)
        .format(IMAGE_FILETYPE)
        .blockAds(true)
        .blockCookieBanners(true)
        .blockBannersByHeuristics(false)
        .blockTrackers(true)
        .delay(0)
        .timeout(SCREENSHOT_ONE_TIMEOUT_S)
        .responseType("by_format")
        .imageQuality(80)
        .viewportWidth(HOMEPAGE_SCREENSHOT_WIDTH)
        .viewportHeight(HOMEPAGE_SCREENSHOT_HEIGHT)
        .deviceScaleFactor(2)
        .darkMode(theme === "dark");
}

export default async function generateHomepageImages({
    url,
    theme
}: {
    url: string;
    theme?: Theme;
}): Promise<MaybeErrorResponse> {
    try {
        const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`;

        const themes: Theme[] = theme != null ? [theme] : ["light", "dark"];
        const results = await Promise.allSettled(
            themes.map(async (t) => {
                await takeScreenshotAndWriteToAws({ url: urlWithProtocol, theme: t });
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
            console.error(`All homepage screenshots failed for ${url}:`, errors);
            return {
                errorResponse: NextResponse.json(
                    { error: `Failed to generate homepage images: ${errors.join("; ")}` },
                    { status: 500 }
                )
            };
        }

        if (errors.length > 0) {
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
    }
}

async function takeScreenshotAndWriteToAws({ url, theme }: { url: string; theme: Theme }) {
    const screenshotBuffer = await fetchScreenshotWithRetry({ url, theme });

    await getS3Client().send(
        new PutObjectCommand({
            Bucket: getHomepageImagesS3BucketName(),
            Key: getS3KeyForHomepageScreenshot({ url, theme }),
            Body: screenshotBuffer,
            ContentType: "image/jpeg",
            ACL: "private"
        })
    );
}

async function fetchScreenshotWithRetry({ url, theme }: { url: string; theme: Theme }): Promise<Buffer> {
    const client = getScreenshotOneClient();
    const options = buildTakeOptions({ url, theme });

    for (let attempt = 1; attempt <= SCREENSHOT_RETRY_ATTEMPTS; attempt++) {
        try {
            const blob = await client.take(options);
            return Buffer.from(await blob.arrayBuffer());
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const isLastAttempt = attempt >= SCREENSHOT_RETRY_ATTEMPTS;

            if (!isLastAttempt) {
                console.warn(
                    `Screenshot attempt ${attempt}/${SCREENSHOT_RETRY_ATTEMPTS} failed (${message}), retrying...`
                );
                await new Promise((resolve) => globalThis.setTimeout(resolve, RETRY_DELAY_MS * attempt));
                continue;
            }

            throw error;
        }
    }

    throw new Error("Failed to take screenshot after all retry attempts");
}
