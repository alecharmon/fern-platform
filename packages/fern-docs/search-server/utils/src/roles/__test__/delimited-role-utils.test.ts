import { createDelimitedRolesetCombinations } from "../delimited-role-utils";

describe("createExplodedDelimitedRoleset", () => {
    it("should return []", () => {
        expect(createDelimitedRolesetCombinations({ roleset: [] })).toEqual([]);
    });

    it("should return [a, b, a&b]", () => {
        expect(createDelimitedRolesetCombinations({ roleset: ["a", "b"] }).sort()).toEqual(["a", "b", "a&b"].sort());
    });

    it("should return [a, b, c, a&b, a&c, b&c, a&b&c]", () => {
        expect(createDelimitedRolesetCombinations({ roleset: ["a", "b", "c"] }).sort()).toEqual(
            ["a", "b", "c", "a&b", "a&c", "b&c", "a&b&c"].sort()
        );
    });

    it("should return [a, b, c, d, a&b, a&c, a&d, b&c, b&d, c&d, a&b&c, a&b&d, a&c&d, b&c&d, a&b&c&d]", () => {
        expect(
            createDelimitedRolesetCombinations({
                roleset: ["a", "b", "c", "d"]
            }).sort()
        ).toEqual(
            [
                "a",
                "b",
                "c",
                "d",
                "a&b",
                "a&c",
                "a&d",
                "b&c",
                "b&d",
                "c&d",
                "a&b&c",
                "a&b&d",
                "a&c&d",
                "b&c&d",
                "a&b&c&d"
            ].sort()
        );
    });
});
