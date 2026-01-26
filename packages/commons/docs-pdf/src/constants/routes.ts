/**
 * Server route used to fetch the list of pages to render.
 */
export const PRINT_PAGES_PATH = "_print/pages";

/**
 * Prefix for the server route used to render each content page.
 * Full URL is `${baseUrl}/${PRINT_PAGE_PATH_PREFIX}/${slug}`.
 */
export const PRINT_PAGE_PATH_PREFIX = "_print/page";

/**
 * Server route for the standalone cover page.
 */
export const PRINT_COVER_PATH = "_print/cover";

/**
 * Server route for the table-of-contents page.
 */
export const PRINT_TOC_PATH = "_print/toc";
