import "server-only";

import { unstable_cache } from "next/cache";

import { getObjectLastModified, getPresignedUrlForS3Object } from "@/app/services/s3";

import { getHomepageImagesS3BucketName } from "../../../api/homepage-images/constants";
import generateHomepageImages from "../../../api/homepage-images/generate/handler";
import { getS3KeyForHomepageScreenshot } from "../../../api/homepage-images/getS3KeyForHomepageScreenshot";
import type { Theme } from "../../../api/homepage-images/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function getHomepageImageUrlUncached({ url, theme }: { url: string; theme: Theme }) {
    console.debug(`Getting homepage image for ${url}`);
    const bucketName = getHomepageImagesS3BucketName();
    const objectKey = getS3KeyForHomepageScreenshot({ url, theme });

    const lastModified = await getObjectLastModified({ bucketName, objectKey });
    const screenshotExists = lastModified != null;
    const isStale = lastModified == null || Date.now() - lastModified.getTime() > ONE_DAY_MS;

    if (!screenshotExists || isStale) {
        try {
            const result = await generateHomepageImages({ url, theme });
            if (result.errorResponse != null) {
                console.warn(`Homepage image generation returned error for ${url}, skipping`);
                if (screenshotExists) {
                    return {
                        imageUrl: await getPresignedUrlForS3Object({ bucketName, objectKey })
                    };
                }
                return null;
            }
        } catch (error) {
            console.warn(`Homepage image generation failed for ${url}:`, error);
            if (screenshotExists) {
                return {
                    imageUrl: await getPresignedUrlForS3Object({ bucketName, objectKey })
                };
            }
            return null;
        }
    }

    // Re-verify the specific theme's object exists after generation
    const existsAfterGeneration = await getObjectLastModified({ bucketName, objectKey });
    if (existsAfterGeneration == null) {
        return null;
    }

    return {
        imageUrl: await getPresignedUrlForS3Object({ bucketName, objectKey })
    };
}

export function getHomepageImageUrl({ url, theme }: { url: string; theme: Theme }) {
    return unstable_cache(() => getHomepageImageUrlUncached({ url, theme }), ["homepage-image-url", url, theme], {
        revalidate: 3600 * 3 // 3 hours
    })();
}
