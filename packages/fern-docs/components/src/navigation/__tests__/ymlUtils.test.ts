import { DocsYmlUpdate, StoredNavigationData } from "../types";
import { buildDocsYmlWithUpdates } from "../ymlUtils";

describe("buildDocsYmlWithUpdates", () => {
  const createNavData = (
    baseContent: string,
    updates: Record<string, DocsYmlUpdate> = {}
  ): StoredNavigationData => ({
    clientPages: {},
    docsYmlState: {
      baseContent,
      pendingUpdates: updates,
      lastFetched: Date.now(),
    },
    committedFiles: new Set(),
    pageContents: {},
  });

  const createUpdate = (
    sectionTitle: string | null,
    page: string,
    path: string
  ): DocsYmlUpdate => ({
    sectionTitle,
    pageEntry: { page, path },
    createdAt: Date.now(),
    operation: "add",
  });

  it("returns base content when no pending updates", () => {
    const result = buildDocsYmlWithUpdates(
      createNavData("navigation:\n  - page: test")
    );
    expect(result).toBe("navigation:\n  - page: test");
  });

  it("throws error when pending updates exist but no base content", () => {
    const updates = {
      "path1.mdx": createUpdate("Section", "Page1", "path1.mdx"),
      "path2.mdx": createUpdate("Section", "Page2", "path2.mdx"),
      "path3.mdx": createUpdate(null, "Root", "path3.mdx"),
    };

    for (const [key, update] of Object.entries(updates)) {
      expect(() =>
        buildDocsYmlWithUpdates(createNavData("", { [key]: update }))
      ).toThrow(
        "Cannot build docs.yml: base content not available but pending updates exist"
      );
    }
  });

  it("applies pending updates to existing base content", () => {
    const baseContent = `navigation:
  - section: Existing Section
    contents:
      - page: Existing Page
        path: docs/pages/existing.mdx`;

    const updates = {
      "new.mdx": createUpdate("New Section", "New Page", "docs/pages/new.mdx"),
    };
    const result = buildDocsYmlWithUpdates(createNavData(baseContent, updates));

    expect(result).toContain("Existing Section");
    expect(result).toContain("New Section");
  });
});
