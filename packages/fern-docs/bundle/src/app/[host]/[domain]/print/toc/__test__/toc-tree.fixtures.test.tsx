import fs from "node:fs";
import path from "node:path";
import type { FernNavigation } from "@fern-api/fdr-sdk";
import prettier from "prettier";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocsPdfExportPlanner } from "../../docs-pdf-export-planner";
import { PrintTocTree } from "../toc-tree";

vi.mock("server-only", () => ({}));

type TocItem =
    | { kind: "group"; depth: number; title: string }
    | { kind: "page"; depth: number; title: string; slug: string };

function loadRootFixture(name: string): FernNavigation.RootNode {
    const [repoRoot] = __dirname.split(`${path.sep}packages${path.sep}`);
    if (repoRoot == null) {
        throw new Error(`Unable to resolve repo root from __dirname: ${__dirname}`);
    }
    const fixturePath = path.join(repoRoot, "packages", "fdr-sdk", "src", "__test__", "output", name, "node.json");
    const raw = fs.readFileSync(fixturePath, "utf-8");
    return JSON.parse(raw) as FernNavigation.RootNode;
}

function snapshotPath(dir: string, file: string): string {
    return path.resolve(__dirname, "snapshots", dir, file);
}

async function renderTocHtml(entries: Parameters<typeof PrintTocTree>[0]["entries"]): Promise<string> {
    const raw = renderToStaticMarkup(
        <ol data-fern-toc-list="">
            <PrintTocTree entries={entries} />
        </ol>
    );
    return prettier.format(raw, { parser: "html", printWidth: 120, tabWidth: 2 });
}

function extractTocItemsFromHtml(html: string): TocItem[] {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.querySelector("ol[data-fern-toc-list]");
    if (root == null) {
        return [];
    }

    const items: TocItem[] = [];
    for (const el of root.querySelectorAll("a[data-fern-toc-row], div[data-fern-toc-depth]")) {
        if (el instanceof HTMLAnchorElement && el.matches("a[data-fern-toc-row]")) {
            const slug = el.getAttribute("data-fern-slug") ?? "";
            const depthAttr = el.getAttribute("data-fern-toc-depth") ?? "0";
            const depth = Number.parseInt(depthAttr, 10);
            const title = el.querySelector("[data-fern-toc-title]")?.textContent?.trim() ?? "";
            items.push({ kind: "page", depth: Number.isFinite(depth) ? depth : 0, title, slug });
            continue;
        }

        if (el instanceof HTMLDivElement && el.matches("div[data-fern-toc-depth]")) {
            // This is a non-leaf group row (not printable leaf).
            const depthAttr = el.getAttribute("data-fern-toc-depth") ?? "0";
            const depth = Number.parseInt(depthAttr, 10);
            const title = el.textContent?.trim() ?? "";
            items.push({ kind: "group", depth: Number.isFinite(depth) ? depth : 0, title });
        }
    }
    return items;
}

async function assertFixtureTocSnapshots(
    snapshotDir: string,
    root: FernNavigation.RootNode,
    params: { productId?: string; versionId?: string }
) {
    const planner = new DocsPdfExportPlanner();
    const resolution = planner.resolveExportSubtree(root, params);
    const entries = planner.buildExportTocEntries(resolution.subtreeRoot);

    const tocHtml = await renderTocHtml(entries);
    await expect(tocHtml).toMatchFileSnapshot(snapshotPath(snapshotDir, "toc.html"));

    const tocItems = extractTocItemsFromHtml(tocHtml);
    await expect(JSON.stringify(tocItems, null, 2) + "\n").toMatchFileSnapshot(
        snapshotPath(snapshotDir, "toc-items.json")
    );
}

describe("PrintTocTree fixture snapshots", () => {
    it("no-version-no-tabs", async () => {
        await assertFixtureTocSnapshots("no-version-no-tabs", loadRootFixture("no-version-no-tabs"), {});
    });

    it("no-version-yes-tabs", async () => {
        await assertFixtureTocSnapshots("no-version-yes-tabs", loadRootFixture("no-version-yes-tabs"), {});
    });

    it("yes-version-no-tabs (default)", async () => {
        await assertFixtureTocSnapshots("yes-version-no-tabs/default", loadRootFixture("yes-version-no-tabs"), {});
    });

    it("yes-version-no-tabs (Version 2)", async () => {
        await assertFixtureTocSnapshots("yes-version-no-tabs/version-2", loadRootFixture("yes-version-no-tabs"), {
            versionId: "Version 2"
        });
    });

    it("yes-version-yes-tabs (default)", async () => {
        await assertFixtureTocSnapshots("yes-version-yes-tabs/default", loadRootFixture("yes-version-yes-tabs"), {});
    });

    it("webflow (Data API default version)", async () => {
        await assertFixtureTocSnapshots("webflow/data-api-default", loadRootFixture("webflow"), {});
    });

    it("webflow (Data API v1 legacy)", async () => {
        await assertFixtureTocSnapshots("webflow/data-api-v1-legacy", loadRootFixture("webflow"), {
            productId: "Data API",
            versionId: "v1 (legacy)"
        });
    });

    it("webflow (Designer API)", async () => {
        await assertFixtureTocSnapshots("webflow/designer-api", loadRootFixture("webflow"), {
            productId: "Designer API"
        });
    });
});
