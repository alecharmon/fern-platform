import type { DocsYmlChange, NavigationSnapshot } from "../types";
import { buildDocsYmlFromChanges } from "../ymlUtils";

describe("buildDocsYmlFromChanges", () => {
    const createNavSnapshot = (
        baseContent: string,
        changes: Map<string, DocsYmlChange> = new Map()
    ): NavigationSnapshot => ({
        schemaVersion: 1,
        branchName: "test-branch",
        metadata: {
            orgName: "test-org",
            docsUrl: "test-docs-url"
        },
        pageRegistry: {},
        docsYmlBaseContent: baseContent,
        docsYmlChanges: changes,
        version: 0
    });

    const createChange = (
        type: "add_page" | "remove_page",
        page: string,
        path: string,
        sectionTitle?: string | null
    ): DocsYmlChange => ({
        type,
        sectionTitle,
        pageEntry: { page, path },
        createdAt: Date.now()
    });

    it("returns base content when no pending changes", () => {
        const result = buildDocsYmlFromChanges(createNavSnapshot("navigation:\n  - page: test"));
        expect(result).toBe("navigation:\n  - page: test");
    });

    it("throws error when pending changes exist but no base content", () => {
        const changes = new Map<string, DocsYmlChange>();
        changes.set("path1.mdx", createChange("add_page", "Page1", "path1.mdx", "Section"));

        const snapshot: NavigationSnapshot = {
            schemaVersion: 1,
            branchName: "test-branch",
            metadata: {
                orgName: "test-org",
                docsUrl: "test-docs-url"
            },
            pageRegistry: {},
            docsYmlBaseContent: null, // null should trigger the error
            docsYmlChanges: changes,
            version: 0
        };

        expect(() => buildDocsYmlFromChanges(snapshot)).toThrow("Cannot build docs.yml: base content unavailable");
    });

    it("applies pending changes to existing base content", () => {
        const baseContent = `navigation:
  - section: Existing Section
    contents:
      - page: Existing Page
        path: docs/pages/existing.mdx`;

        const changes = new Map<string, DocsYmlChange>();
        changes.set("new.mdx", createChange("add_page", "New Page", "docs/pages/new.mdx", "New Section"));

        const result = buildDocsYmlFromChanges(createNavSnapshot(baseContent, changes));

        expect(result).toContain("Existing Section");
        expect(result).toContain("New Section");
    });
});
