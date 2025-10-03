export function getSignedImageUrlBucketName() {
    if (process.env.VE_IMAGES_PUBLIC_S3_BUCKET_NAME == null) {
        throw new Error("VE_IMAGES_PUBLIC_S3_BUCKET_NAME is not defined in the environment");
    }
    return process.env.VE_IMAGES_PUBLIC_S3_BUCKET_NAME;
}
