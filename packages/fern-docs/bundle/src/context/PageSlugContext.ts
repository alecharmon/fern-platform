import { cache } from "react";

/**
 * Request-scoped store for the current page slug.
 * Set once per page render in shared-page.tsx, read by MdxServerComponentProseSuspense
 * so that API description serialization calls automatically include the page slug
 * for better identification in batch-serialize logs.
 *
 * Uses React's `cache()` which is scoped to a single server-component render pass (i.e., one request).
 * Different requests get independent stores — no cross-request leakage.
 */
const getPageSlugStore = cache((): { slug: string | undefined } => ({ slug: undefined }));

export const getCurrentPageSlug = () => getPageSlugStore().slug;

export const setCurrentPageSlug = (slug: string | undefined) => {
    getPageSlugStore().slug = slug;
};
