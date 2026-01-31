/**
 * @vitest-environment jsdom
 */

import { EVERYONE_ROLE } from "@fern-api/docs-utils";
import { render } from "@testing-library/react";
import { type Atom, atom } from "jotai";
import { freezeAtom } from "jotai/utils";
// biome-ignore lint/correctness/noUnusedImports: React is needed for JSX in vitest jsdom environment
import * as React from "react";

import { If } from "./If";

/**
 * Creates a test roles atom that simulates the roles from the URL path.
 *
 * In the new roles-based approach:
 * - `false` = not logged in, only has [EVERYONE_ROLE]
 * - `[]` = logged in with no specific roles, but still has [EVERYONE_ROLE]
 * - `["role1", "role2"]` = logged in with specific roles, plus EVERYONE_ROLE
 *
 * Note: In the new approach, "logged in" is determined by the isLoggedIn parameter,
 * not by the roles array. This is a separate state from roles.
 */
function createTestRolesAtom(roles: string[] | false): Atom<string[]> {
    if (roles === false) {
        return freezeAtom(atom([EVERYONE_ROLE]));
    }
    // Always include EVERYONE_ROLE for authenticated users
    return freezeAtom(atom([...roles, EVERYONE_ROLE]));
}

/**
 * Creates a test logged-in atom that simulates the isLoggedIn state from the URL path.
 */
function createTestLoggedInAtom(isLoggedIn: boolean): Atom<boolean> {
    return freezeAtom(atom(isLoggedIn));
}

describe("If", () => {
    it("renders when the roles=[], and the user is logged in with a specific role", async () => {
        const { findByText } = render(
            <If
                roles={[]}
                __test_roles_atom={createTestRolesAtom(["some-role"])}
                __test_logged_in_atom={createTestLoggedInAtom(true)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when user matches role exactly", async () => {
        const { findByText } = render(
            <If roles={["beta-users"]} __test_roles_atom={createTestRolesAtom(["beta-users"])}>
                capture_the_flag
            </If>
        );

        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when user overlaps with one of the roles", async () => {
        const { findByText } = render(
            <If
                roles={["beta-users", "alpha-users"]}
                __test_roles_atom={createTestRolesAtom(["beta-users", "theta-users"])}
            >
                capture_the_flag
            </If>
        );

        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the user does not overlap with any of the roles", async () => {
        const { findByText } = render(
            <If roles={["beta-users"]} __test_roles_atom={createTestRolesAtom(["alpha-users"])}>
                capture_the_flag
            </If>
        );

        await expect(findByText("capture_the_flag", { exact: false })).rejects.toThrow();
    });

    it("hides when the roles=[], and the user has no specific roles (only everyone)", async () => {
        const { findByText } = render(
            <If
                roles={[]}
                __test_roles_atom={createTestRolesAtom([])}
                __test_logged_in_atom={createTestLoggedInAtom(false)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the roles=[], and the user exists and has a role", async () => {
        const { findByText } = render(
            <If
                roles={[]}
                __test_roles_atom={createTestRolesAtom(["beta-users"])}
                __test_logged_in_atom={createTestLoggedInAtom(true)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the roles=[], and the user is not logged in", async () => {
        const { findByText } = render(
            <If
                roles={[]}
                __test_roles_atom={createTestRolesAtom(false)}
                __test_logged_in_atom={createTestLoggedInAtom(false)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the roles=undefined, and the user exists", async () => {
        const { findByText } = render(<If __test_roles_atom={createTestRolesAtom([])}>capture_the_flag</If>);
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when the roles=undefined, and the user does not exist", async () => {
        const { findByText } = render(<If __test_roles_atom={createTestRolesAtom(false)}>capture_the_flag</If>);
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the not=true, and user is not logged in", async () => {
        const { findByText } = render(
            <If not __test_roles_atom={createTestRolesAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("hides when the not=true, and user is logged in", async () => {
        const { findByText } = render(
            <If not __test_roles_atom={createTestRolesAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when loggedIn=true and user has specific roles", async () => {
        const { findByText } = render(
            <If
                loggedIn
                __test_roles_atom={createTestRolesAtom(["some-role"])}
                __test_logged_in_atom={createTestLoggedInAtom(true)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when loggedIn=true, and user is not logged in", async () => {
        const { findByText } = render(
            <If
                loggedIn
                __test_roles_atom={createTestRolesAtom(false)}
                __test_logged_in_atom={createTestLoggedInAtom(false)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when not loggedIn=true, and user is not logged in", async () => {
        const { findByText } = render(
            <If
                not
                loggedIn
                __test_roles_atom={createTestRolesAtom(false)}
                __test_logged_in_atom={createTestLoggedInAtom(false)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when not loggedIn=true, and user has specific roles", async () => {
        const { findByText } = render(
            <If
                not
                loggedIn
                __test_roles_atom={createTestRolesAtom(["some-role"])}
                __test_logged_in_atom={createTestLoggedInAtom(true)}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the role is everyone, including when the user is not logged in", async () => {
        const { findByText } = render(
            <If roles={["everyone"]} __test_roles_atom={createTestRolesAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when the role is everyone, and the user is logged in", async () => {
        const { findByText } = render(
            <If roles={["everyone"]} __test_roles_atom={createTestRolesAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the user matches role and the not=true", async () => {
        const { findByText } = render(
            <If not roles={["beta-users"]} __test_roles_atom={createTestRolesAtom(["beta-users", "beta-users-2"])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the user does not match a role and not=true", async () => {
        const { findByText } = render(
            <If not roles={["beta-users"]} __test_roles_atom={createTestRolesAtom(["alpha-users", "theta-users"])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when not=true && roles=[], and the user is logged in", async () => {
        const { findByText } = render(
            <If
                not
                roles={[]}
                __test_roles_atom={createTestRolesAtom(["beta-users"])}
                __test_logged_in_atom={createTestLoggedInAtom(true)}
            >
                capture_the_flag
            </If>
        );
        // not roles=[] means "show if NOT logged in"
        // isLoggedIn=true, so content should be hidden
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when not=true && roles=[], and the user has no specific roles (only everyone)", async () => {
        const { findByText } = render(
            <If not roles={[]} __test_roles_atom={createTestRolesAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when not=true && roles=[], and the user is not logged in", async () => {
        const { findByText } = render(
            <If not roles={[]} __test_roles_atom={createTestRolesAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    describe("products prop", () => {
        it("renders when the current product matches one of the specified products", async () => {
            const { findByText } = render(
                <If products={["api-reference", "docs"]} __test_product_id="api-reference">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when the current product does not match any of the specified products", async () => {
            const { findByText } = render(
                <If products={["api-reference", "docs"]} __test_product_id="sdks">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("hides when products is specified but current product is undefined", async () => {
            const { findByText } = render(<If products={["api-reference"]}>capture_the_flag</If>);
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when products is empty array (no filtering)", async () => {
            const { findByText } = render(
                <If products={[]} __test_product_id="api-reference">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when not=true and product matches", async () => {
            const { findByText } = render(
                <If not products={["api-reference"]} __test_product_id="api-reference">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when not=true and product does not match", async () => {
            const { findByText } = render(
                <If not products={["api-reference"]} __test_product_id="sdks">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });
    });

    describe("versions prop", () => {
        it("renders when the current version matches one of the specified versions", async () => {
            const { findByText } = render(
                <If versions={["v2", "v3"]} __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when the current version does not match any of the specified versions", async () => {
            const { findByText } = render(
                <If versions={["v2", "v3"]} __test_version_id="v1">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("hides when versions is specified but current version is undefined", async () => {
            const { findByText } = render(<If versions={["v2"]}>capture_the_flag</If>);
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when versions is empty array (no filtering)", async () => {
            const { findByText } = render(
                <If versions={[]} __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when not=true and version matches", async () => {
            const { findByText } = render(
                <If not versions={["v2"]} __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when not=true and version does not match", async () => {
            const { findByText } = render(
                <If not versions={["v2"]} __test_version_id="v1">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });
    });

    describe("combined conditions", () => {
        it("renders when both product and version match", async () => {
            const { findByText } = render(
                <If
                    products={["api-reference"]}
                    versions={["v2"]}
                    __test_product_id="api-reference"
                    __test_version_id="v2"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when product matches but version does not", async () => {
            const { findByText } = render(
                <If
                    products={["api-reference"]}
                    versions={["v2"]}
                    __test_product_id="api-reference"
                    __test_version_id="v1"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("hides when version matches but product does not", async () => {
            const { findByText } = render(
                <If products={["api-reference"]} versions={["v2"]} __test_product_id="sdks" __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when role, product, and version all match", async () => {
            const { findByText } = render(
                <If
                    roles={["beta-users"]}
                    products={["api-reference"]}
                    versions={["v2"]}
                    __test_roles_atom={createTestRolesAtom(["beta-users"])}
                    __test_product_id="api-reference"
                    __test_version_id="v2"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when role matches but product does not", async () => {
            const { findByText } = render(
                <If
                    roles={["beta-users"]}
                    products={["api-reference"]}
                    __test_roles_atom={createTestRolesAtom(["beta-users"])}
                    __test_product_id="sdks"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });
    });

    // Tests for viewer prop (alias for roles)
    describe("viewer prop (alias for roles)", () => {
        it("renders when viewer matches user role", async () => {
            const { findByText } = render(
                <If viewer={["beta-users"]} __test_roles_atom={createTestRolesAtom(["beta-users"])}>
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when viewer does not match user role", async () => {
            const { findByText } = render(
                <If viewer={["beta-users"]} __test_roles_atom={createTestRolesAtom(["alpha-users"])}>
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when viewer is everyone and user is not logged in", async () => {
            const { findByText } = render(
                <If viewer={["everyone"]} __test_roles_atom={createTestRolesAtom(false)}>
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when viewer is a specific role and user is not logged in", async () => {
            const { findByText } = render(
                <If viewer={["work-trial"]} __test_roles_atom={createTestRolesAtom(false)}>
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("roles prop takes precedence over viewer prop", async () => {
            const { findByText } = render(
                <If
                    roles={["alpha-users"]}
                    viewer={["beta-users"]}
                    __test_roles_atom={createTestRolesAtom(["alpha-users"])}
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });
    });

    describe("products prop", () => {
        it("renders when the current product matches one of the specified products", async () => {
            const { findByText } = render(
                <If products={["api-reference", "docs"]} __test_product_id="api-reference">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when the current product does not match any of the specified products", async () => {
            const { findByText } = render(
                <If products={["api-reference", "docs"]} __test_product_id="sdks">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("hides when products is specified but current product is undefined", async () => {
            const { findByText } = render(<If products={["api-reference"]}>capture_the_flag</If>);
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when products is empty array (no filtering)", async () => {
            const { findByText } = render(
                <If products={[]} __test_product_id="api-reference">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when not=true and product matches", async () => {
            const { findByText } = render(
                <If not products={["api-reference"]} __test_product_id="api-reference">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when not=true and product does not match", async () => {
            const { findByText } = render(
                <If not products={["api-reference"]} __test_product_id="sdks">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });
    });

    describe("versions prop", () => {
        it("renders when the current version matches one of the specified versions", async () => {
            const { findByText } = render(
                <If versions={["v2", "v3"]} __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when the current version does not match any of the specified versions", async () => {
            const { findByText } = render(
                <If versions={["v2", "v3"]} __test_version_id="v1">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("hides when versions is specified but current version is undefined", async () => {
            const { findByText } = render(<If versions={["v2"]}>capture_the_flag</If>);
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when versions is empty array (no filtering)", async () => {
            const { findByText } = render(
                <If versions={[]} __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when not=true and version matches", async () => {
            const { findByText } = render(
                <If not versions={["v2"]} __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when not=true and version does not match", async () => {
            const { findByText } = render(
                <If not versions={["v2"]} __test_version_id="v1">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });
    });

    describe("combined conditions", () => {
        it("renders when both product and version match", async () => {
            const { findByText } = render(
                <If
                    products={["api-reference"]}
                    versions={["v2"]}
                    __test_product_id="api-reference"
                    __test_version_id="v2"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when product matches but version does not", async () => {
            const { findByText } = render(
                <If
                    products={["api-reference"]}
                    versions={["v2"]}
                    __test_product_id="api-reference"
                    __test_version_id="v1"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("hides when version matches but product does not", async () => {
            const { findByText } = render(
                <If products={["api-reference"]} versions={["v2"]} __test_product_id="sdks" __test_version_id="v2">
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });

        it("renders when role, product, and version all match", async () => {
            const { findByText } = render(
                <If
                    roles={["beta-users"]}
                    products={["api-reference"]}
                    versions={["v2"]}
                    __test_roles_atom={createTestRolesAtom(["beta-users"])}
                    __test_product_id="api-reference"
                    __test_version_id="v2"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).resolves.toBeDefined();
        });

        it("hides when role matches but product does not", async () => {
            const { findByText } = render(
                <If
                    roles={["beta-users"]}
                    products={["api-reference"]}
                    __test_roles_atom={createTestRolesAtom(["beta-users"])}
                    __test_product_id="sdks"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });
    });
});
