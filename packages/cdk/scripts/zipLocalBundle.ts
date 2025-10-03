import { LOCAL_PREVIEW_BUNDLE_OUT_DIR, resolveLocalPreviewBundleTarPath, zipLocalBundle } from "../src/docs-fe-stack";

/**
 * Command-line wrapper for zipLocalBundle.
 * Usage: tsx zip-local-bundle.ts [zipFilePath]
 */
async function mainZipLocalBundle() {
    const [, , zipFilePathArg] = process.argv;
    try {
        const localPreviewBundleTarPath = resolveLocalPreviewBundleTarPath(zipFilePathArg);
        await zipLocalBundle(localPreviewBundleTarPath);
        console.log(`Successfully zipped ${LOCAL_PREVIEW_BUNDLE_OUT_DIR} to ${localPreviewBundleTarPath}`);
    } catch (err) {
        console.error("Error zipping local bundle:", err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}

// Allow running from command line
if (require.main === module) {
    void mainZipLocalBundle();
}
