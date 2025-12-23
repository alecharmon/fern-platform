import type { Hast, MdxJsxAttribute } from "@fern-docs/mdx";
import { expandHighlightRanges } from "./expand-highlight-ranges";

function createMockNode(highlightValue: string): Hast.MdxJsxElement {
    return {
        type: "mdxJsxFlowElement",
        name: "TestComponent",
        attributes: [
            {
                type: "mdxJsxAttribute",
                name: "highlight",
                value: {
                    type: "mdxJsxAttributeValueExpression",
                    value: highlightValue,
                    data: {}
                }
            }
        ],
        children: []
    };
}

function getHighlightValue(node: Hast.MdxJsxElement): string | undefined {
    const attr = node.attributes.find(
        (a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === "highlight"
    );
    if (attr?.value && typeof attr.value === "object" && attr.value.type === "mdxJsxAttributeValueExpression") {
        return attr.value.value;
    }
    return undefined;
}

describe("expandHighlightRanges", () => {
    it("should expand a simple range", () => {
        const node = createMockNode("[1-5]");
        expandHighlightRanges(node);
        expect(getHighlightValue(node)).toBe("[1, 2, 3, 4, 5]");
    });

    it("should expand a range with individual numbers", () => {
        const node = createMockNode("[1-3, 7, 9]");
        expandHighlightRanges(node);
        expect(getHighlightValue(node)).toBe("[1, 2, 3, 7, 9]");
    });

    it("should expand multiple ranges", () => {
        const node = createMockNode("[1-3, 5-7]");
        expandHighlightRanges(node);
        expect(getHighlightValue(node)).toBe("[1, 2, 3, 5, 6, 7]");
    });

    it("should not modify arrays without ranges", () => {
        const node = createMockNode("[1, 2, 3]");
        expandHighlightRanges(node);
        expect(getHighlightValue(node)).toBe("[1, 2, 3]");
    });

    it("should handle whitespace in the expression", () => {
        const node = createMockNode("[ 1-3 , 5 ]");
        expandHighlightRanges(node);
        expect(getHighlightValue(node)).toBe("[1, 2, 3, 5]");
    });

    it("should handle out-of-order list", () => {
        const node = createMockNode("[ 5, 1-3 ]");
        expandHighlightRanges(node);
        expect(getHighlightValue(node)).toBe("[5, 1, 2, 3]");
    });

    it("should not modify non-highlight attributes", () => {
        const node: Hast.MdxJsxElement = {
            type: "mdxJsxFlowElement",
            name: "TestComponent",
            attributes: [
                {
                    type: "mdxJsxAttribute",
                    name: "otherProp",
                    value: {
                        type: "mdxJsxAttributeValueExpression",
                        value: "[1-5]",
                        data: {}
                    }
                }
            ],
            children: []
        };
        expandHighlightRanges(node);
        const attr = node.attributes.find(
            (a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === "otherProp"
        );
        if (attr?.value && typeof attr.value === "object" && attr.value.type === "mdxJsxAttributeValueExpression") {
            expect(attr.value.value).toBe("[1-5]");
        }
    });

    it("should handle string attribute values", () => {
        const node: Hast.MdxJsxElement = {
            type: "mdxJsxFlowElement",
            name: "TestComponent",
            attributes: [
                {
                    type: "mdxJsxAttribute",
                    name: "highlight",
                    value: "some-string"
                }
            ],
            children: []
        };
        expandHighlightRanges(node);
        const attr = node.attributes.find(
            (a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === "highlight"
        );
        expect(attr?.value).toBe("some-string");
    });

    it("should create valid estree for the expanded array", () => {
        const node = createMockNode("[1-3]");
        expandHighlightRanges(node);
        const attr = node.attributes.find(
            (a): a is MdxJsxAttribute => a.type === "mdxJsxAttribute" && a.name === "highlight"
        );
        if (attr?.value && typeof attr.value === "object" && attr.value.type === "mdxJsxAttributeValueExpression") {
            const estree = attr.value.data?.estree;
            expect(estree).toBeDefined();
            expect(estree?.type).toBe("Program");
            expect(estree?.body[0]?.type).toBe("ExpressionStatement");
        }
    });
});
