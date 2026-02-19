import fs from "node:fs";
import path from "node:path";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import { describe, expect, it, vi } from "vitest";

import { DocsPdfExportPlanner, ExportSubtreeResolutionError } from "../docs-pdf-export-planner";

vi.mock("server-only", () => ({}));

function loadRootFixture(name: string): FernNavigation.RootNode {
    const [repoRoot] = __dirname.split(`${path.sep}packages${path.sep}`);
    if (repoRoot == null) {
        throw new Error(`Unable to resolve repo root from __dirname: ${__dirname}`);
    }
    const fixturePath = path.join(repoRoot, "packages", "fdr-sdk", "src", "__test__", "output", name, "node.json");
    const raw = fs.readFileSync(fixturePath, "utf-8");
    return JSON.parse(raw) as FernNavigation.RootNode;
}

describe("DocsPdfExportPlanner.resolveExportSubtree", () => {
    const planner = new DocsPdfExportPlanner();

    it("unversioned: resolves with no params", () => {
        const root = loadRootFixture("no-version-no-tabs");
        const { subtreeRoot, ...rest } = planner.resolveExportSubtree(root, {});
        expect({ ...rest, subtreeRootType: subtreeRoot.type }).toEqual({
            subtreeRootType: "unversioned",
            resolvedProduct: undefined,
            resolvedVersion: undefined,
            availableProducts: [],
            availableVersions: []
        });
    });

    it("unversioned: throws when product is specified", () => {
        const root = loadRootFixture("no-version-no-tabs");
        expect(() => planner.resolveExportSubtree(root, { productId: "foo" })).toThrow(ExportSubtreeResolutionError);
    });

    it("unversioned: throws when version is specified", () => {
        const root = loadRootFixture("no-version-no-tabs");
        expect(() => planner.resolveExportSubtree(root, { versionId: "v1" })).toThrow(ExportSubtreeResolutionError);
    });

    it("versioned: defaults to the default version with no params", () => {
        const root = loadRootFixture("yes-version-no-tabs");
        const { subtreeRoot, ...rest } = planner.resolveExportSubtree(root, {});
        expect({ ...rest, subtreeRootType: subtreeRoot.type }).toEqual({
            subtreeRootType: "version",
            resolvedProduct: undefined,
            resolvedVersion: { versionId: "Version 1", title: "Version 1", isDefault: true },
            availableProducts: [],
            availableVersions: [
                { versionId: "Version 1", title: "Version 1", isDefault: true },
                { versionId: "Version 2", title: "Version 2", isDefault: false }
            ]
        });
    });

    it("versioned: resolves explicit version", () => {
        const root = loadRootFixture("yes-version-no-tabs");
        const { subtreeRoot, ...rest } = planner.resolveExportSubtree(root, { versionId: "Version 2" });
        expect({ ...rest, subtreeRootType: subtreeRoot.type }).toEqual({
            subtreeRootType: "version",
            resolvedProduct: undefined,
            resolvedVersion: { versionId: "Version 2", title: "Version 2", isDefault: false },
            availableProducts: [],
            availableVersions: [
                { versionId: "Version 1", title: "Version 1", isDefault: true },
                { versionId: "Version 2", title: "Version 2", isDefault: false }
            ]
        });
    });

    it("versioned: throws when product is specified", () => {
        const root = loadRootFixture("yes-version-no-tabs");
        expect(() => planner.resolveExportSubtree(root, { productId: "some-product" })).toThrow(
            ExportSubtreeResolutionError
        );
    });

    it("versioned: throws for non-existent version", () => {
        const root = loadRootFixture("yes-version-no-tabs");
        expect(() => planner.resolveExportSubtree(root, { versionId: "Version 99" })).toThrow(
            ExportSubtreeResolutionError
        );
    });

    it("multi-product: resolves default product/version with no params", () => {
        const root = loadRootFixture("webflow");
        const { subtreeRoot, availableProducts, ...rest } = planner.resolveExportSubtree(root, {});
        expect({
            ...rest,
            subtreeRootType: subtreeRoot.type,
            availableProductsCount: availableProducts.length
        }).toEqual({
            subtreeRootType: "version",
            resolvedProduct: { productId: "Data API", title: "Data API", isDefault: false },
            resolvedVersion: { versionId: "v2", title: "v2", isDefault: true },
            availableVersions: [
                { versionId: "v2", title: "v2", isDefault: true },
                { versionId: "v2 (beta)", title: "v2 (beta)", isDefault: false },
                { versionId: "v1 (legacy)", title: "v1 (legacy)", isDefault: false }
            ],
            availableProductsCount: 5
        });
    });

    it("multi-product: resolves specific unversioned product", () => {
        const root = loadRootFixture("webflow");
        const { subtreeRoot, availableProducts, ...rest } = planner.resolveExportSubtree(root, {
            productId: "Designer API"
        });
        expect({
            ...rest,
            subtreeRootType: subtreeRoot.type,
            availableProductsCount: availableProducts.length
        }).toEqual({
            subtreeRootType: "unversioned",
            resolvedProduct: { productId: "Designer API", title: "Designer API", isDefault: false },
            availableVersions: [],
            availableProductsCount: 5
        });
    });

    it("multi-product: resolves explicit version within versioned product", () => {
        const root = loadRootFixture("webflow");
        const dataLegacy = planner.resolveExportSubtree(root, { productId: "Data API", versionId: "v1 (legacy)" });
        expect({
            subtreeRootType: dataLegacy.subtreeRoot.type,
            resolvedProduct: dataLegacy.resolvedProduct,
            resolvedVersion: dataLegacy.resolvedVersion
        }).toEqual({
            subtreeRootType: "version",
            resolvedProduct: { productId: "Data API", title: "Data API", isDefault: false },
            resolvedVersion: { versionId: "v1 (legacy)", title: "v1 (legacy)", isDefault: false }
        });
    });

    it("multi-product: throws for non-existent product", () => {
        const root = loadRootFixture("webflow");
        expect(() => planner.resolveExportSubtree(root, { productId: "Nonexistent" })).toThrow(
            ExportSubtreeResolutionError
        );
    });

    it("multi-product: throws when version is specified for unversioned product", () => {
        const root = loadRootFixture("webflow");
        expect(() => planner.resolveExportSubtree(root, { productId: "Designer API", versionId: "v1" })).toThrow(
            ExportSubtreeResolutionError
        );
    });

    it("multi-product: throws for non-existent version within valid product", () => {
        const root = loadRootFixture("webflow");
        expect(() => planner.resolveExportSubtree(root, { productId: "Data API", versionId: "v99" })).toThrow(
            ExportSubtreeResolutionError
        );
    });
});

describe("DocsPdfExportPlanner.collectExportablePages", () => {
    const planner = new DocsPdfExportPlanner();

    it("collects a stable list of exportable pages for webflow Data API", () => {
        const root = loadRootFixture("webflow");
        const res = planner.resolveExportSubtree(root, { productId: "Data API" });
        const pages = planner.collectExportablePages(res.subtreeRoot);
        // Single assertion: ensure we got a non-empty list of well-formed pages.
        expect(pages).toEqual(
            expect.arrayContaining([expect.objectContaining({ slug: expect.any(String), title: expect.any(String) })])
        );
    });
});
