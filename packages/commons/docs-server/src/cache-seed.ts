import { MDX_PIPELINE_VERSION } from "./mdx-pipeline-version";

/**
 * Returns the semantic version for MDX pipeline caching.
 *
 * This version is used in cache keys for MDX serialization and docs loading.
 * It only changes when the MDX processing pipeline is updated, not on every deployment.
 *
 * @returns The current MDX pipeline version
 */
export function cacheSeed() {
    return MDX_PIPELINE_VERSION;
}
