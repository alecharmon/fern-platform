/**
 * @vitest-environment jsdom
 */

import type { FernUser } from "@fern-api/docs-auth";

import { render } from "@testing-library/react";
import { type Atom, atom } from "jotai";
import { freezeAtom } from "jotai/utils";

import { If } from "./If";

function createTestFernUserAtom(roles: string[] | false): Atom<FernUser | undefined> {
    return freezeAtom(atom(roles ? { roles } : undefined));
}

describe("If", () => {
    it("renders when the roles=[], and the user is logged with roles=[]", async () => {
        const { findByText } = render(
            <If roles={[]} __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when user matches role exactly", async () => {
        const { findByText } = render(
            <If roles={["beta-users"]} __test_fern_user_atom={createTestFernUserAtom(["beta-users"])}>
                capture_the_flag
            </If>
        );

        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when user overlaps with one of the roles", async () => {
        const { findByText } = render(
            <If
                roles={["beta-users", "alpha-users"]}
                __test_fern_user_atom={createTestFernUserAtom(["beta-users", "theta-users"])}
            >
                capture_the_flag
            </If>
        );

        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the user does not overlap with any of the roles", async () => {
        const { findByText } = render(
            <If roles={["beta-users"]} __test_fern_user_atom={createTestFernUserAtom(["alpha-users"])}>
                capture_the_flag
            </If>
        );

        await expect(findByText("capture_the_flag", { exact: false })).rejects.toThrow();
    });

    it("renders when the roles=[], and the user exists", async () => {
        const { findByText } = render(
            <If roles={[]} __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when the roles=[], and the user exists and has a role", async () => {
        const { findByText } = render(
            <If roles={[]} __test_fern_user_atom={createTestFernUserAtom(["beta-users"])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the roles=[], and the user is not logged in", async () => {
        const { findByText } = render(
            <If roles={[]} __test_fern_user_atom={createTestFernUserAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the roles=undefined, and the user exists", async () => {
        const { findByText } = render(<If __test_fern_user_atom={createTestFernUserAtom([])}>capture_the_flag</If>);
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when the roles=undefined, and the user does not exist", async () => {
        const { findByText } = render(<If __test_fern_user_atom={createTestFernUserAtom(false)}>capture_the_flag</If>);
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the not=true, and user is not logged in", async () => {
        const { findByText } = render(
            <If not __test_fern_user_atom={createTestFernUserAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("hides when the not=true, and user is logged in", async () => {
        const { findByText } = render(
            <If not __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when loggedIn=true", async () => {
        const { findByText } = render(
            <If loggedIn __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when loggedIn=true, and user is not logged in", async () => {
        const { findByText } = render(
            <If loggedIn __test_fern_user_atom={createTestFernUserAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when not loggedIn=true, and user is not logged in", async () => {
        const { findByText } = render(
            <If not loggedIn __test_fern_user_atom={createTestFernUserAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when not loggedIn=true, and user is logged in", async () => {
        const { findByText } = render(
            <If not loggedIn __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the role is everyone, including when the user is not logged in", async () => {
        const { findByText } = render(
            <If roles={["everyone"]} __test_fern_user_atom={createTestFernUserAtom(false)}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when the role is everyone, and the user is logged in", async () => {
        const { findByText } = render(
            <If roles={["everyone"]} __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when the user matches role and the not=true", async () => {
        const { findByText } = render(
            <If
                not
                roles={["beta-users"]}
                __test_fern_user_atom={createTestFernUserAtom(["beta-users", "beta-users-2"])}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when the user does not match a role and not=true", async () => {
        const { findByText } = render(
            <If
                not
                roles={["beta-users"]}
                __test_fern_user_atom={createTestFernUserAtom(["alpha-users", "theta-users"])}
            >
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("renders when not=true && roles=[], and the user's roles do not overlap", async () => {
        const { findByText } = render(
            <If not roles={[]} __test_fern_user_atom={createTestFernUserAtom(["beta-users"])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).resolves.toBeDefined();
    });

    it("hides when not=true && roles=[], and the user has role=[], and not=true", async () => {
        const { findByText } = render(
            <If not roles={[]} __test_fern_user_atom={createTestFernUserAtom([])}>
                capture_the_flag
            </If>
        );
        await expect(findByText("capture_the_flag")).rejects.toThrow();
    });

    it("renders when not=true && roles=[], and the user is not logged in", async () => {
        const { findByText } = render(
            <If not roles={[]} __test_fern_user_atom={createTestFernUserAtom(false)}>
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
                    __test_fern_user_atom={createTestFernUserAtom(["beta-users"])}
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
                    __test_fern_user_atom={createTestFernUserAtom(["beta-users"])}
                    __test_product_id="sdks"
                >
                    capture_the_flag
                </If>
            );
            await expect(findByText("capture_the_flag")).rejects.toThrow();
        });
    });
});
