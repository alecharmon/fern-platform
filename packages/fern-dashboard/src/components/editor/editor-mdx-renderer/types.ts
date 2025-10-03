import { MdxJsxExpressionAttribute } from "@fern-docs/mdx";

// example: intent="warning"
export interface StringAttribute {
    type: "string";
    value: string;
}

// example: cols={2}
export interface ValueAttribute {
    type: "value";
    rawStringValue: string;
}

export type AttributeValue = StringAttribute | ValueAttribute;

export type KeyedAttributes = Record<string, AttributeValue>;

interface JSXElementChildrenRichText {
    type: "RICH_TEXT";
    childrenMdx: string;
}

interface JSXElementChildrenAllowed {
    type: "ALLOWED";
    childrenMdx: string;
}

interface JSXElementChildrenDisallowed {
    type: "DISALLOWED";
}

export type JSXElementChildren = JSXElementChildrenRichText | JSXElementChildrenAllowed | JSXElementChildrenDisallowed;

export interface JSXElement {
    type: "jsxElement";
    value: {
        children: JSXElementChildren;
        contentDraggingDisabled: boolean;
        name: string;
        keyedAttributes: KeyedAttributes;
        expressionAttributes: MdxJsxExpressionAttribute[];
    };
}

export interface TerminalElement {
    type: "terminalElement";
    originalMdx: string;
}

export type ParsedMarkdownElement = JSXElement | TerminalElement;
