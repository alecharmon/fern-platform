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

export interface JSXElement {
  type: "jsxElement";
  value: {
    richTextContent: boolean;
    name: string;
    keyedAttributes: KeyedAttributes;
    expressionAttributes: MdxJsxExpressionAttribute[];
    childrenMdx: string;
  };
}

export interface TerminalElement {
  type: "terminalElement";
  originalMdx: string;
}

export type ParsedMarkdownElement = JSXElement | TerminalElement;
