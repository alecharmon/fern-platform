import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeId } from "@fern-api/fdr-sdk/navigation";
import { describe, expect, it } from "vitest";

import { getFallbackProduct, getFallbackVersion, getProducts, getTabs } from "./handle-node-fallbacks";
import {
    createFoundNode,
    createNotFoundNode,
    createPageNode,
    createProductNode,
    createRootNode,
    createTabNode,
    createVersionNode
} from "./utils/create-node";

describe("handle-node-fallbacks", () => {
    describe("getFallbackProduct", () => {
        it("should return product from found node parents", () => {
            const productNode = createProductNode("test-product", "Test Product", false);
            const pageNode = createPageNode("test-page", "Test Page");

            const foundNode: FernNavigation.utils.Node = createFoundNode(
                pageNode,
                [productNode],
                createRootNode([productNode], "productgroup")
            );

            const root = createRootNode([productNode], "productgroup");

            const result = getFallbackProduct(foundNode, root, "test-product/test-page");
            expect(result).toEqual(productNode);
        });

        it("should return product based on slug match", () => {
            const productNode = createProductNode("test-product", "Test Product", false);
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode], "productgroup");

            const result = getFallbackProduct(foundNode, root, "test-product/test-page");
            expect(result).toEqual(productNode);
        });

        it("should not return product if slug match does not exact match start with product slug", () => {
            const productNode = createProductNode("test-product", "Test Product", false);
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode], "productgroup");

            const result = getFallbackProduct(foundNode, root, "test-producttttt/test-page");
            expect(result).toEqual(productNode);
        });

        it("should not return product if slug match does not start with product slug", () => {
            const productNode = createProductNode("test-product", "Test Product", false);
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode], "productgroup");

            const result = getFallbackProduct(foundNode, root, "/extra/test-product/test-page");
            expect(result).toEqual(productNode);
        });

        it("should return first product from product group if no match found", () => {
            const productNode = createProductNode("default-product", "Default Product");
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode], "productgroup");

            const result = getFallbackProduct(foundNode, root, "non-existent");
            expect(result).toEqual(productNode);
        });

        it("should return null if no product can be found", () => {
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([]);

            const result = getFallbackProduct(foundNode, root, "non-existent");
            expect(result).toBeNull();
        });
    });

    describe("getFallbackVersion", () => {
        it("should return version from found node parents", () => {
            const versionNode = createVersionNode("v1", []);
            const productNode = createProductNode("test-product", "Test Product", true);
            const pageNode = createPageNode("test-page", "Test Page");

            const foundNode: FernNavigation.utils.Node = createFoundNode(
                pageNode,
                [versionNode, productNode],
                createRootNode([productNode], "versioned")
            );
            const root = createRootNode([productNode], "versioned");

            const result = getFallbackVersion(foundNode, root, "test-product/v1/test-page");
            expect(result).toEqual(versionNode);
        });

        it("should return version based on slug match in product", () => {
            const versionNode = createVersionNode("v1", []);
            const productNode = createProductNode("test-product", "Test Product", true);
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode], "versioned");

            const result = getFallbackVersion(foundNode, root, "test-product/v1/test-page");
            expect(result).toEqual(versionNode);
        });

        it("should return first version from product if no match found", () => {
            const versionNode = createVersionNode("v1", []);
            const productNode = createProductNode("test-product", "Test Product", true);
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode], "versioned");

            const result = getFallbackVersion(foundNode, root, "test-product/non-existent");
            expect(result).toEqual(versionNode);
        });

        it("should return null if no version can be found", () => {
            const productNode = createProductNode("test-product", "Test Product", false);
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();
            const root = createRootNode([productNode]);

            const result = getFallbackVersion(foundNode, root, "test-product/non-existent");
            expect(result).toBeNull();
        });
    });

    describe("getTabs", () => {
        it("should return tabs from found node if available", () => {
            const tabNode = createTabNode("tab1", "Tab 1");
            const pageNode = createPageNode("test-page", "Test Page");
            const productNode = createProductNode("test-product", "Test Product", false);

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(pageNode, [productNode], createRootNode([productNode], "productgroup")),
                tabs: [tabNode]
            };
            const root = createRootNode([productNode], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([tabNode]);
        });

        it("should return tabs from root if node not found and root has tabs", () => {
            const tabNode = createTabNode("tab1", "Tab 1");
            const productNode = createProductNode("test-product", "Test Product", false);
            const root = createRootNode([productNode], "unversioned");
            if (root.child.type === "unversioned") {
                root.child.child = {
                    type: "tabbed",
                    id: FernNavigation.NodeId("tabbed"),
                    children: [tabNode]
                };
            }
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([tabNode]);
        });

        it("should return tabs from unversioned product if node not found", () => {
            const tabNode = createTabNode("tab1", "Tab 1");
            const productNode = createProductNode("test-product", "Test Product", false);
            if (productNode.child.type === "unversioned") {
                productNode.child.child = {
                    type: "tabbed",
                    id: FernNavigation.NodeId("tabbed"),
                    children: [tabNode]
                };
            }
            const root = createRootNode([productNode], "unversioned");
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([tabNode]);
        });

        it("should return tabs from versioned product if node not found", () => {
            const tabNode = createTabNode("tab1", "Tab 1");
            const versionNode = createVersionNode("v1", []);
            versionNode.child = {
                type: "tabbed",
                id: FernNavigation.NodeId("tabbed"),
                children: [tabNode]
            };
            const productNode = createProductNode("test-product", "Test Product", true);
            if (productNode.child.type === "versioned") {
                productNode.child.children = [versionNode];
            }
            const root = createRootNode([productNode], "versioned");
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();

            const result = getTabs(foundNode, root, "test-product/v1/test-page", false, []);
            expect(result).toEqual([tabNode]);
        });

        it("should return tabs from version if node not found and no product tabs", () => {
            const tabNode = createTabNode("tab1", "Tab 1");
            const versionNode = createVersionNode("v1", []);
            versionNode.child = {
                type: "tabbed",
                id: FernNavigation.NodeId("tabbed"),
                children: [tabNode]
            };
            const productNode = createProductNode("test-product", "Test Product", true);
            if (productNode.child.type === "versioned") {
                productNode.child.children = [versionNode];
            }
            const root = createRootNode([productNode], "versioned");
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();

            const result = getTabs(foundNode, root, "test-product/v1/test-page", false, []);
            expect(result).toEqual([tabNode]);
        });

        it("should return null if no tabs are available", () => {
            const productNode = createProductNode("test-product", "Test Product", false, {
                type: "unversioned",
                id: NodeId("unversioned"),
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: NodeId("sidebarRoot"),
                    children: []
                }
            });
            const root = createRootNode([productNode], "productgroup");
            const foundNode: FernNavigation.utils.Node = createNotFoundNode();

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toBeNull();
        });

        it("should filter authenticated tabs when showHiddenNodes is false", () => {
            const authedTab = createTabNode("authed-tab", "Authed Tab");
            authedTab.authed = true;
            const publicTab = createTabNode("public-tab", "Public Tab");
            publicTab.authed = false;

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(
                    createPageNode("test-page", "Test Page"),
                    [createProductNode("test-product", "Test Product", false)],
                    createRootNode([], "productgroup")
                ),
                tabs: [authedTab, publicTab]
            };
            const root = createRootNode([], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([publicTab]);
        });

        it("should return all tabs including authenticated ones when showHiddenNodes is true", () => {
            const authedTab = createTabNode("authed-tab", "Authed Tab");
            authedTab.authed = true;
            const publicTab = createTabNode("public-tab", "Public Tab");
            publicTab.authed = false;

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(
                    createPageNode("test-page", "Test Page"),
                    [createProductNode("test-product", "Test Product", false)],
                    createRootNode([], "productgroup")
                ),
                tabs: [authedTab, publicTab]
            };
            const root = createRootNode([], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", true, []);
            expect(result).toEqual([authedTab, publicTab]);
        });

        it("should return tabs with everyone viewer even when showHiddenNodes is false", () => {
            const everyoneTab = createTabNode("everyone-tab", "Everyone Tab");
            everyoneTab.viewers = [FernNavigation.RoleId("everyone")];
            const restrictedTab = createTabNode("restricted-tab", "Restricted Tab");
            restrictedTab.viewers = [FernNavigation.RoleId("admin")];
            const publicTab = createTabNode("public-tab", "Public Tab");
            publicTab.viewers = [];

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(
                    createPageNode("test-page", "Test Page"),
                    [createProductNode("test-product", "Test Product", false)],
                    createRootNode([], "productgroup")
                ),
                tabs: [everyoneTab, restrictedTab, publicTab]
            };
            const root = createRootNode([], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([everyoneTab, publicTab]);
        });

        it("should filter out hidden tabs when showHiddenNodes is false", () => {
            const hiddenTab = createTabNode("hidden-tab", "Hidden Tab");
            hiddenTab.hidden = true;
            const visibleTab = createTabNode("visible-tab", "Visible Tab");
            visibleTab.hidden = false;

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(
                    createPageNode("test-page", "Test Page"),
                    [createProductNode("test-product", "Test Product", false)],
                    createRootNode([], "productgroup")
                ),
                tabs: [hiddenTab, visibleTab]
            };
            const root = createRootNode([], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([visibleTab]);
        });

        it("should include hidden tab if it is the current tab", () => {
            const hiddenTab = createTabNode("hidden-tab", "Hidden Tab");
            hiddenTab.hidden = true;
            const visibleTab = createTabNode("visible-tab", "Visible Tab");
            visibleTab.hidden = false;

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(
                    createPageNode("test-page", "Test Page"),
                    [createProductNode("test-product", "Test Product", false)],
                    createRootNode([], "productgroup")
                ),
                tabs: [hiddenTab, visibleTab],
                currentTab: hiddenTab
            };
            const root = createRootNode([], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", false, []);
            expect(result).toEqual([hiddenTab, visibleTab]);
        });

        it("should return all tabs including hidden ones when showHiddenNodes is true", () => {
            const hiddenTab = createTabNode("hidden-tab", "Hidden Tab");
            hiddenTab.hidden = true;
            const visibleTab = createTabNode("visible-tab", "Visible Tab");
            visibleTab.hidden = false;

            const foundNode: FernNavigation.utils.Node = {
                ...createFoundNode(
                    createPageNode("test-page", "Test Page"),
                    [createProductNode("test-product", "Test Product", false)],
                    createRootNode([], "productgroup")
                ),
                tabs: [hiddenTab, visibleTab]
            };
            const root = createRootNode([], "productgroup");

            const result = getTabs(foundNode, root, "test-product/test-page", true, []);
            expect(result).toEqual([hiddenTab, visibleTab]);
        });
    });

    describe("getProducts", () => {
        it("should return null if root is not a productgroup", () => {
            const root = createRootNode([], "unversioned");
            const result = getProducts(root, false, []);
            expect(result).toBeNull();
        });

        it("should return all products when showHiddenNodes is true", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, true, []);
            expect(result).toEqual([product1, product2]);
        });

        it("should return all products when showHiddenNodes is true even if some are authenticated", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product2.authed = true;
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, true, []);
            expect(result).toEqual([product1, product2]);
        });

        it("should filter out authenticated products when showHiddenNodes is false", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product2.authed = true;
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, false, []);
            expect(result).toEqual([product1]);
        });

        it("should return products with no viewers when showHiddenNodes is false", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product1.viewers = [];
            product2.viewers = [];
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, false, []);
            expect(result).toEqual([product1, product2]);
        });

        it("should return products with everyone viewer when showHiddenNodes is false", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product1.viewers = [FernNavigation.RoleId("everyone")];
            product2.viewers = [FernNavigation.RoleId("admin")];
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, false, []);
            expect(result).toEqual([product1]);
        });

        it("should return products that match user roles when showHiddenNodes is false", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            const product3 = createProductNode("product3", "Product 3", false);
            product1.viewers = [FernNavigation.RoleId("admin")];
            product2.viewers = [FernNavigation.RoleId("user")];
            product3.viewers = [FernNavigation.RoleId("everyone")];
            const root = createRootNode([product1, product2, product3], "productgroup");

            const result = getProducts(root, false, ["admin", "user"]);
            expect(result).toEqual([product1, product2, product3]);
        });

        it("should not return products that don't match user roles when showHiddenNodes is false", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product1.viewers = [FernNavigation.RoleId("admin")];
            product2.viewers = [FernNavigation.RoleId("user")];
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, false, ["admin"]);
            expect(result).toEqual([product1]);
        });

        it("should return non-product nodes regardless of authentication status", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product2.authed = true;
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, false, []);
            expect(result).toEqual([product1]);
        });

        it("should return empty array when no products match criteria", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            product1.authed = true;
            product2.authed = true;
            const root = createRootNode([product1, product2], "productgroup");

            const result = getProducts(root, false, []);
            expect(result).toEqual([]);
        });

        it("should handle products with mixed viewer configurations", () => {
            const product1 = createProductNode("product1", "Product 1", false);
            const product2 = createProductNode("product2", "Product 2", false);
            const product3 = createProductNode("product3", "Product 3", false);
            const product4 = createProductNode("product4", "Product 4", false);

            product1.viewers = [FernNavigation.RoleId("everyone")];
            product2.viewers = [];
            product3.viewers = [FernNavigation.RoleId("admin")];
            product4.authed = true;

            const root = createRootNode([product1, product2, product3, product4], "productgroup");

            const result = getProducts(root, false, ["admin"]);
            expect(result).toEqual([product1, product2, product3]);
        });
    });
});
