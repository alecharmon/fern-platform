import { astToMDX, type MdastNodes, type MdxJsxExpressionAttribute, mdxToAST } from "@fern-docs/mdx";

import type { AttributeValue, JSXElement, JSXElementChildren, ParsedMarkdownElement } from "./types";

const richTextComponents = [
    "Callout",
    "Card",
    "Button",
    "Tab",
    "Accordion",
    "Step",
    "StepGroup",
    "Info",
    "Warning",
    "Success",
    "Error",
    "Note",
    "Tip",
    "Check",
    "LaunchNote",
    "ParamField"
];

const componentsWithoutChildren = [
    "embed",
    "img",
    "EndpointRequestSnippet",
    "EndpointResponseSnippet",
    "EndpointSchemaSnippet"
];

const editableComponents = [...richTextComponents, ...componentsWithoutChildren];

const contentDraggingDisabledComponents = ["Button"];

// HTML elements that mark boundaries - these and all their children will be treated as terminal/non-editable
const boundaryElements = ["div", "span", "section", "article", "body", "aside"];

export function parseMDX(mdx: string): ParsedMarkdownElement[] {
    // Parse MDX to AST using mdxToAST
    const { mdast } = mdxToAST(mdx);

    const result: ParsedMarkdownElement[] = [];

    // Function to traverse the AST and extract parent-child relationships
    function traverse(node: MdastNodes): ParsedMarkdownElement | ParsedMarkdownElement[] {
        if (node.type === "paragraph" && node.children && Array.isArray(node.children)) {
            const hasOnlyImages = node.children.every(
                (child) => child.type === "image" || child.type === "imageReference"
            );
            if (hasOnlyImages && node.children.length > 0) {
                // Return each image as a separate jsxElement
                return node.children.map((child) => ({
                    type: "jsxElement" as const,
                    value: {
                        contentDraggingDisabled: true,
                        name: "img",
                        keyedAttributes: {
                            src: { type: "string" as const, value: (child as any).url || "" },
                            alt: { type: "string" as const, value: (child as any).alt || "" }
                        },
                        expressionAttributes: [],
                        children: { type: "DISALLOWED" as const }
                    }
                })) as any;
            }
        }

        // Check if this is a boundary element - if so, treat it and all children as terminal
        const isBoundaryElement =
            node.type === "mdxJsxFlowElement" && node.name != null && boundaryElements.includes(node.name);

        if (isBoundaryElement) {
            return {
                type: "terminalElement",
                originalMdx: astToMDX(node)
            };
        }

        const isEditableComponent =
            node.type === "mdxJsxFlowElement" && node.name != null && editableComponents.includes(node.name);

        if (!isEditableComponent) {
            // A node is terminal if:
            // - it is not a rich text node
            // - none of its children are rich text nodes
            // - none of its children have children
            // Note(cberry): this is sort of a heuristic i'm making up
            let isTerminal = true;
            if ("children" in node && node.children && Array.isArray(node.children)) {
                for (const child of node.children) {
                    if (
                        child.type === "mdxJsxFlowElement" &&
                        child.name != null &&
                        richTextComponents.includes(child.name)
                    ) {
                        isTerminal = false;
                        break;
                    }

                    if (
                        "children" in child &&
                        child.children &&
                        Array.isArray(child.children) &&
                        child.children.length > 0
                    ) {
                        isTerminal = false;
                        break;
                    }
                }
            }

            // If this is a terminal node, return it as a terminal element
            if (isTerminal || node.type !== "mdxJsxFlowElement" || node.name == null) {
                return {
                    type: "terminalElement",
                    originalMdx: astToMDX(node)
                };
            }
        }

        // Separate string and non-string attributes
        const keyedAttributes: Record<string, AttributeValue> = {};
        const expressionAttributes: MdxJsxExpressionAttribute[] = [];

        node.attributes?.forEach((attr) => {
            if (attr.type === "mdxJsxAttribute") {
                if (attr.value != null) {
                    if (typeof attr.value === "string") {
                        keyedAttributes[attr.name] = {
                            type: "string",
                            value: attr.value
                        };
                    } else {
                        keyedAttributes[attr.name] = {
                            type: "value",
                            rawStringValue: attr.value.value
                        };
                    }
                }
            } else {
                expressionAttributes.push(attr);
            }
        });

        const nodeName = node.name || "";
        const childrenMdx = astToMDX({ type: "root", children: node.children });
        let children: JSXElementChildren = { type: "ALLOWED", childrenMdx };
        if (richTextComponents.includes(nodeName)) {
            children = { type: "RICH_TEXT", childrenMdx };
        } else if (componentsWithoutChildren.includes(nodeName)) {
            children = { type: "DISALLOWED" };
        }

        const element: JSXElement = {
            type: "jsxElement",
            value: {
                contentDraggingDisabled: contentDraggingDisabledComponents.includes(node.name || ""),
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                name: node.name!,
                keyedAttributes,
                expressionAttributes,
                children
            }
        };

        return element;
    }

    // Start traversing from the root's children
    const rootNode = mdast;
    for (const child of rootNode.children) {
        const element = traverse(child);
        // Handle case where traverse returns multiple elements (e.g., paragraph with only images)
        if (Array.isArray(element)) {
            result.push(...element);
        } else {
            result.push(element);
        }
    }

    return result;
}

// Export the component arrays for use in playground
export {
    richTextComponents,
    componentsWithoutChildren,
    editableComponents,
    contentDraggingDisabledComponents,
    boundaryElements
};
