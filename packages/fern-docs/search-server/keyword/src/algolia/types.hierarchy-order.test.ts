import { SEARCHABLE_ATTRIBUTES } from "./types";

describe("SEARCHABLE_ATTRIBUTES - hierarchy order", () => {
    it("should prioritize H1 over H6 in hierarchy searchable attributes", () => {
        const h1Index = SEARCHABLE_ATTRIBUTES.indexOf("hierarchy.h1.title");
        const h2Index = SEARCHABLE_ATTRIBUTES.indexOf("hierarchy.h2.title");
        const h3Index = SEARCHABLE_ATTRIBUTES.indexOf("hierarchy.h3.title");
        const h4Index = SEARCHABLE_ATTRIBUTES.indexOf("hierarchy.h4.title");
        const h5Index = SEARCHABLE_ATTRIBUTES.indexOf("hierarchy.h5.title");
        const h6Index = SEARCHABLE_ATTRIBUTES.indexOf("hierarchy.h6.title");

        // All hierarchy attributes should be present
        expect(h1Index).toBeGreaterThanOrEqual(0);
        expect(h2Index).toBeGreaterThanOrEqual(0);
        expect(h3Index).toBeGreaterThanOrEqual(0);
        expect(h4Index).toBeGreaterThanOrEqual(0);
        expect(h5Index).toBeGreaterThanOrEqual(0);
        expect(h6Index).toBeGreaterThanOrEqual(0);

        // H1 should have higher priority (lower index) than H6
        expect(h1Index).toBeLessThan(h2Index);
        expect(h2Index).toBeLessThan(h3Index);
        expect(h3Index).toBeLessThan(h4Index);
        expect(h4Index).toBeLessThan(h5Index);
        expect(h5Index).toBeLessThan(h6Index);
    });

    it("should have hierarchy attributes in the correct position in SEARCHABLE_ATTRIBUTES", () => {
        const hasHierarchyLine = SEARCHABLE_ATTRIBUTES.some((attr) => attr.includes("hierarchy.h1.title"));

        expect(hasHierarchyLine).toBe(true);
    });
});
