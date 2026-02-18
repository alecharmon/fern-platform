import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { createRoleFacet } from "@fern-docs/search-utils";

interface CreateSearchFiltersOpts {
    domain: string;

    /**
     * roles are ignored if the user is unauthed
     * but if they are authed, we automatically include the "everyone" role
     */
    roles: string[];

    /**
     * If false, filters out any content that is only visible to unauthed users
     */
    authed: boolean;

    /**
     * If provided, restricts search results to records matching these basepaths.
     * Used for basepath-routed domains where each subrepo has its own basepath.
     * When undefined, no basepath filter is applied (backward compatible).
     */
    basepaths?: string[];
}

const VISIBLE_BY_FACET = "visible_by";
const AUTHED_FACET = "authed";

export function createSearchFilters({ domain, roles, authed, basepaths }: CreateSearchFiltersOpts): string {
    let filters: string;
    if (!authed) {
        filters = `domain:${domain} AND ${AUTHED_FACET}:false`;
    } else {
        const uniqueRoles = [...new Set(roles.filter((r) => r !== EVERYONE_ROLE))];
        const roleFilters = [
            `${VISIBLE_BY_FACET}:${createRoleFacet([EVERYONE_ROLE])}`,
            ...uniqueRoles.map((role) => `${VISIBLE_BY_FACET}:${createRoleFacet([role])}`)
        ];
        filters = `domain:${domain} AND (${roleFilters.join(" OR ")})`;
    }

    if (basepaths != null && basepaths.length > 0) {
        if (basepaths.length === 1) {
            filters += ` AND basepath:${basepaths[0]}`;
        } else {
            const basepathFilter = basepaths.map((bp) => `basepath:${bp}`).join(" OR ");
            filters += ` AND (${basepathFilter})`;
        }
    }

    return filters;
}
