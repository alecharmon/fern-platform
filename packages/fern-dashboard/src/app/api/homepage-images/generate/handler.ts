import { PutObjectCommand } from "@aws-sdk/client-s3";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
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

export default async function generateHomepageImages({ url }: { url: string }): Promise<MaybeErrorResponse> {
    let browser: Browser | undefined;

    try {
        if (isProduction()) {
            browser = await puppeteer.launch({
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: true
            });
        } else {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            });
        }

        const page = await browser.newPage();
        await page.setViewport({
            width: HOMEPAGE_SCREENSHOT_WIDTH,
            height: HOMEPAGE_SCREENSHOT_HEIGHT,
            deviceScaleFactor: 2
        });

        const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`;
        await takeScreenshotAndWriteToAws({
            page,
            url: urlWithProtocol,
            theme: "light"
        });
        await takeScreenshotAndWriteToAws({
            page,
            url: urlWithProtocol,
            theme: "dark"
        });

        return { data: undefined };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function takeScreenshotAndWriteToAws({ page, url, theme }: { page: Page; url: string; theme: Theme }) {
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);

    await page.goto(url.toString(), {
        waitUntil: "load"
    });

    // wait for icons and images to load
    await setTimeout(3_000);

    const screenshotBuffer = await page.screenshot();

    // this must stay in sync with the IMAGE_FILETYPE constant
    const compressedScreenshotBuffer = await sharp(screenshotBuffer)[IMAGE_FILETYPE]({ quality: 50 }).toBuffer();

    if (process.env.NEXT_PUBLIC_HOMEPAGE_IMAGES_S3_BUCKET_NAME == null) {
        throw new Error("NEXT_PUBLIC_HOMEPAGE_IMAGES_S3_BUCKET_NAME is not defined in the environment");
    }

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
