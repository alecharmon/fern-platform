/**
 * Base params that are available in all routes
 */
export interface BaseParams {
    host: string;
    domain: string;
    lang: string;
}

/**
 * Params for routes with a slug
 */
export interface PageParams extends BaseParams {
    slug: string;
}
