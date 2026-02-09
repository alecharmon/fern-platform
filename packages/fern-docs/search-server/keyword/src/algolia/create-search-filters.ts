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
}

const VISIBLE_BY_FACET = "visible_by";
const AUTHED_FACET = "authed";

export function createSearchFilters({ domain, roles, authed }: CreateSearchFiltersOpts): string {
    if (!authed) {
        // if the user is unauthed, we only want to show content where authed=false
        return `domain:${domain} AND ${AUTHED_FACET}:false`;
    }

    // if the user is authed, we can show both content where authed=false AND authed=true
    // Each individual role is matched independently against the record's visible_by facets.
    const uniqueRoles = [...new Set(roles.filter((r) => r !== EVERYONE_ROLE))];
    const roleFilters = [
        `${VISIBLE_BY_FACET}:${createRoleFacet([EVERYONE_ROLE])}`,
        ...uniqueRoles.map((role) => `${VISIBLE_BY_FACET}:${createRoleFacet([role])}`)
    ];

    return `domain:${domain} AND (${roleFilters.join(" OR ")})`;
}
