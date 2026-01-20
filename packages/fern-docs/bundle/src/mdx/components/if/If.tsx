import type { FernUser } from "@fern-api/docs-auth";
import { useFernUser } from "@fern-docs/components/state/fern-user";
import { useCurrentProductId, useCurrentVersionId } from "@fern-docs/components/state/navigation";
import type { Atom } from "jotai";
import type { PropsWithChildren, ReactNode } from "react";

export interface IfProps {
    /**
     * The role to check against
     */
    roles?: string[];

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
     * A fern user atom for testing purposes only
     */
    __test_fern_user_atom?: Atom<FernUser | undefined>;

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
    loggedIn,
    products,
    versions,
    children,
    __test_fern_user_atom,
    __test_product_id,
    __test_version_id
}: PropsWithChildren<IfProps>): ReactNode {
    const user = useFernUser({ __test_fern_user_atom });
    const currentProductId = useCurrentProductId();
    const currentVersionId = useCurrentVersionId();

    const productId = __test_product_id ?? currentProductId;
    const versionId = __test_version_id ?? currentVersionId;

    const userRoles = user?.roles ?? [];

    if (not && roles?.length === 0 && userRoles.length > 0) {
        return children;
    }

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

        // Original roles/loggedIn logic preserved below
        if (roles != null) {
            if (roles.length === 0) {
                return user != null;
            }
            return roles.some((role) => userRoles.includes(role) || role === "everyone");
        }
        if (loggedIn != null) {
            return loggedIn === (user != null);
        }
        return true;
    };

    const show = not ? !shouldShow() : shouldShow();

    return show ? children : null;
}
