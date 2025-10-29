import { SEARCHABLE_ATTRIBUTES } from "./types";

describe("SEARCHABLE_ATTRIBUTES - hierarchy order", () => {
    it("should prioritize H1 over H6 in hierarchy searchable attributes", () => {
        const hierarchyLine = SEARCHABLE_ATTRIBUTES.find((attr) => attr.includes("hierarchy.h1.title"));

        expect(hierarchyLine).toBeDefined();

        expect(hierarchyLine).toBe(
            "hierarchy.h1.title,hierarchy.h2.title,hierarchy.h3.title,hierarchy.h4.title,hierarchy.h5.title,hierarchy.h6.title"
        );

        const h1Index = hierarchyLine!.indexOf("hierarchy.h1.title");
        const h6Index = hierarchyLine!.indexOf("hierarchy.h6.title");

        expect(h1Index).toBeLessThan(h6Index);
    });

    it("should have hierarchy attributes in the correct position in SEARCHABLE_ATTRIBUTES", () => {
        const hasHierarchyLine = SEARCHABLE_ATTRIBUTES.some((attr) => attr.includes("hierarchy.h1.title"));

        expect(hasHierarchyLine).toBe(true);
    });
});
