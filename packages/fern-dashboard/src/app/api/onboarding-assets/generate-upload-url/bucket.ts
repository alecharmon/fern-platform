export function getOnboardingAssetsBucketName() {
    if (process.env.ONBOARDING_ASSETS_S3_BUCKET_NAME == null) {
        throw new Error("ONBOARDING_ASSETS_S3_BUCKET_NAME is not defined in the environment");
    }
    return process.env.ONBOARDING_ASSETS_S3_BUCKET_NAME;
}
