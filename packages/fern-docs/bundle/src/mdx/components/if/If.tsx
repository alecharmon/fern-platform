import { useLoggedIn } from "@fern-docs/components/state/logged-in";
import { useCurrentProductId, useCurrentVersionId } from "@fern-docs/components/state/navigation";
import { useRoles } from "@fern-docs/components/state/roles";
import type { Atom } from "jotai";
import type { PropsWithChildren, ReactNode } from "react";

export interface IfProps {
    /**
     * The role to check against
     */
    roles?: string[];

    /**
     * Alias for roles (used in some MDX content)
     */
    viewer?: string[];

    /**
     * Invert the role check
     */
    not?: boolean;

    /**
     * Whether the user is logged in
     */
    loggedIn?: boolean;

    /**
     * The product slugs to check against. Content is shown if the current product matches any of the specified products.
     */
    products?: string[];

    /**
     * The version slugs to check against. Content is shown if the current version matches any of the specified versions.
     */
    versions?: string[];

    /**
     * A roles atom for testing purposes only
     */
    __test_roles_atom?: Atom<string[]>;

    /**
     * A logged-in atom for testing purposes only
     */
    __test_logged_in_atom?: Atom<boolean>;

    /**
     * Override the current product slug for testing purposes only
     */
    __test_product_id?: string;

    /**
     * Override the current version slug for testing purposes only
     */
    __test_version_id?: string;
}

/**
 *
 * # Some title
 *
 * <If roles={["beta-users"]}>
 *   <Callout>
 *     This is a callout
 *   </Callout>
 * </If>
 *
 * <If products={["api-reference"]}>
 *   <Callout>
 *     This content only shows in the api-reference product
 *   </Callout>
 * </If>
 *
 * <If versions={["v2", "v3"]}>
 *   <Callout>
 *     This content only shows in v2 or v3
 *   </Callout>
 * </If>
 *
 * some content
 */

export function If({
    not,
    roles,
    viewer,
    loggedIn,
    products,
    versions,
    children,
    __test_roles_atom,
    __test_logged_in_atom,
    __test_product_id,
    __test_version_id
}: PropsWithChildren<IfProps>): ReactNode {
    const currentRoles = useRoles({ __test_roles_atom });
    const currentProductId = useCurrentProductId();
    const currentVersionId = useCurrentVersionId();
    const isLoggedIn = useLoggedIn({ __test_logged_in_atom });

    const productId = __test_product_id ?? currentProductId;
    const versionId = __test_version_id ?? currentVersionId;

    // Support both 'roles' and 'viewer' props (viewer is an alias for roles)
    const effectiveRoles = roles ?? viewer;

    const shouldShow = () => {
        // Check products first - if specified and doesn't match, return false
        if (products != null && products.length > 0) {
            if (productId == null || !products.includes(productId)) {
                return false;
            }
        }

        // Check versions next - if specified and doesn't match, return false
        if (versions != null && versions.length > 0) {
            if (versionId == null || !versions.includes(versionId)) {
                return false;
            }
        }

        // roles=[] means "show if logged in" (using isLoggedIn from path param)
        if (effectiveRoles != null) {
            if (effectiveRoles.length === 0) {
                return isLoggedIn;
            }
            return effectiveRoles.some((role) => currentRoles.includes(role));
        }
        if (loggedIn != null) {
            return loggedIn === isLoggedIn;
        }
        return true;
    };

    const show = not ? !shouldShow() : shouldShow();

    return show ? children : null;
}
