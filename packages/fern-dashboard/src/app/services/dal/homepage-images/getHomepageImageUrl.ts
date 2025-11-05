import "server-only";

import { unstable_cache } from "next/cache";

import { doesObjectExist, getPresignedUrlForS3Object } from "@/app/services/s3";

import { getHomepageImagesS3BucketName } from "../../../api/homepage-images/constants";
import generateHomepageImages from "../../../api/homepage-images/generate/handler";
import { getS3KeyForHomepageScreenshot } from "../../../api/homepage-images/getS3KeyForHomepageScreenshot";
import type { Theme } from "../../../api/homepage-images/types";

async function getHomepageImageUrlUncached({ url, theme }: { url: string; theme: Theme }) {
    console.debug(`Getting homepage image for ${url}`);
    const bucketName = getHomepageImagesS3BucketName();
    const objectKey = getS3KeyForHomepageScreenshot({ url, theme });

    let screenshotExists = await doesObjectExist({
        bucketName: bucketName,
        objectKey
    });

    if (!screenshotExists) {
        await generateHomepageImages({ url });
        // Re-check if the object exists after generation
        screenshotExists = await doesObjectExist({
            bucketName: bucketName,
            objectKey
        });
    }

    if (screenshotExists) {
        return {
            imageUrl: await getPresignedUrlForS3Object({ bucketName, objectKey })
        };
    }

    return null;
}

export function getHomepageImageUrl({ url, theme }: { url: string; theme: Theme }) {
    return unstable_cache(() => getHomepageImageUrlUncached({ url, theme }), ["homepage-image-url", url, theme], {
        revalidate: 3600 * 3 // 3 hours
    })();
}
