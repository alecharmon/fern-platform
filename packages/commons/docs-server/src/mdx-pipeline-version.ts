/**
 * Semantic version for the MDX processing pipeline.
 *
 * This version should be incremented whenever changes are made to:
 * - MDX bundler logic (packages/fern-docs/bundle/src/mdx/bundler/)
 * - MDX plugins (packages/fern-docs/mdx/plugins/)
 * - MDX serializer (packages/fern-docs/bundle/src/server/mdx-serializer.ts)
 * - Remark/rehype plugin versions or configurations
 *
 * This version is used in cache keys to ensure MDX content is reprocessed
 * when the pipeline changes, while avoiding unnecessary recomputation when
 * only UI components or other non-MDX code changes.
 *
 * @example
 * // When updating MDX bundler or plugins:
 * export const MDX_PIPELINE_VERSION = "2";
 */
export const MDX_PIPELINE_VERSION = "4";
