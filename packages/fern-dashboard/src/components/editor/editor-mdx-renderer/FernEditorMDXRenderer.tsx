import React, { useEffect, useMemo, useRef, useState } from "react";

import { useMDXComponents } from "@mdx-js/react";
import { getMDXComponent } from "mdx-bundler/client";

import {
  MdastNodes,
  MdxJsxAttribute,
  MdxJsxExpressionAttribute,
  astToMDX,
  htmlToMdx,
  mdxToAST,
  mdxToHtml,
} from "@fern-docs/mdx";

import TiptapEditor from "@/components/editor/TiptapEditor";
import { EditorComponentProvider } from "@/components/editor/editor-component/EditorComponentContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { useDebounce } from "@/hooks/useDebounce";

import { UnsupportedContent } from "../UnsupportedContent";
import { cachedBundleMDX } from "./cache";
import { AttributeValue, JSXElement, ParsedMarkdownElement } from "./types";

function buildMdxElement(
  name: string,
  keyedAttributes: Record<string, AttributeValue>,
  expressionAttributes: (MdxJsxAttribute | MdxJsxExpressionAttribute)[],
  childrenMdx: string
): string {
  const placeholder = `PLACEHOLDER_${Math.random().toString(36).substring(2, 30)}`;

  const element: MdastNodes = {
    type: "mdxJsxFlowElement",
    name,
    attributes: [
      ...Object.entries(keyedAttributes).map(
        ([key, value]): MdxJsxAttribute =>
          value.type === "string"
            ? {
                type: "mdxJsxAttribute" as const,
                name: key,
                value: value.value,
              }
            : {
                type: "mdxJsxAttribute" as const,
                name: key,
                value: {
                  type: "mdxJsxAttributeValueExpression",
                  value: value.rawStringValue,
                },
              }
      ),
      ...expressionAttributes,
    ],
    children: [
      {
        type: "mdxJsxFlowElement",
        name: placeholder,
        attributes: [],
        children: [],
      },
    ],
  };

  const initial = astToMDX(element);
  const final = initial.replace(`<${placeholder} />`, childrenMdx);
  return final;
}

interface FernEditorMDXRendererProps {
  mdx: string;
  onUpdate: (mdx: string) => unknown;
}

// Bundling state types
interface BundlingState {
  type: "BUNDLING";
}

interface BundledState {
  type: "BUNDLED";
  code: string;
}

interface ErrorState {
  type: "ERROR";
  message: string;
}

type MDXRendererState = BundlingState | BundledState | ErrorState;

/*
This can return JSXElements that have further JSX children,
or it can return JSXElements that are terminal in that they have text children or something 
*/
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
  "ParamField",
];

const contentDraggingDisabledComponents = ["Button"];

function parseMDX(mdx: string): ParsedMarkdownElement[] {
  // Parse MDX to AST using mdxToAST
  const { mdast } = mdxToAST(mdx);

  const result: ParsedMarkdownElement[] = [];

  // Function to traverse the AST and extract parent-child relationships
  function traverse(node: MdastNodes): ParsedMarkdownElement {
    const isRichTextElement =
      node.type === "mdxJsxFlowElement" &&
      node.name != null &&
      richTextComponents.includes(node.name);

    if (!isRichTextElement) {
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
      if (
        isTerminal ||
        node.type !== "mdxJsxFlowElement" ||
        node.name == null
      ) {
        return {
          type: "terminalElement",
          originalMdx: astToMDX(node),
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
              value: attr.value,
            };
          } else {
            keyedAttributes[attr.name] = {
              type: "value",
              rawStringValue: attr.value.value,
            };
          }
        }
      } else {
        expressionAttributes.push(attr);
      }
    });

    const element: JSXElement = {
      type: "jsxElement",
      value: {
        richTextContent: richTextComponents.includes(node.name || ""),
        contentDraggingDisabled: contentDraggingDisabledComponents.includes(
          node.name || ""
        ),
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        name: node.name!,
        keyedAttributes,
        expressionAttributes,
        childrenMdx: astToMDX({ type: "root", children: node.children }),
      },
    };

    return element;
  }

  // Start traversing from the root's children
  const rootNode = mdast;
  for (const child of rootNode.children) {
    const element = traverse(child);
    result.push(element);
  }

  return result;
}

// Loading component for terminal elements
const LoadingTerminalElement = React.memo(() => (
  <Skeleton className="my-2 h-16 w-full" />
));
LoadingTerminalElement.displayName = "LoadingTerminalElement";

// MDX renderer component for terminal elements
interface TerminalMDXRendererProps {
  code: string;
  components: ReturnType<typeof useMDXComponents>;
}

const TerminalMDXRenderer = React.memo(
  ({ code, components }: TerminalMDXRendererProps) => {
    const MDXComponent = useMemo(() => {
      try {
        return getMDXComponent(code);
      } catch (error) {
        console.warn(
          "[TerminalMDXRenderer] Failed to create MDX component:",
          error
        );
        throw error;
      }
    }, [code]);

    return <MDXComponent components={components} />;
  }
);
TerminalMDXRenderer.displayName = "TerminalMDXRenderer";

// Terminal element renderer with bundling logic
interface MDXRendererProps {
  mdx: string;
}

const MDXRenderer = React.memo(({ mdx }: MDXRendererProps) => {
  const [state, setState] = useState<MDXRendererState>({
    type: "BUNDLING",
  });
  const components = useMDXComponents();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await cachedBundleMDX(mdx);
        if (!cancelled) {
          setState({ type: "BUNDLED", code: result.code });
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error bundling MDX:", error);
          setState({ type: "ERROR", message: String(error) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mdx]);

  if (state.type === "BUNDLING") {
    return <LoadingTerminalElement />;
  }

  if (state.type === "ERROR") {
    return (
      <UnsupportedContent>
        {!mdx.includes("<InterceptedChildren />")
          ? mdx
          : "Unsupported markdown"}
      </UnsupportedContent>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <UnsupportedContent>
          {!mdx.includes("<InterceptedChildren />")
            ? mdx
            : "Unsupported markdown"}
        </UnsupportedContent>
      }
    >
      <TerminalMDXRenderer code={state.code} components={components} />
    </ErrorBoundary>
  );
});
MDXRenderer.displayName = "MDXRenderer";

interface JSXElementRendererProps {
  element: JSXElement;
  index: number;
  onUpdate: (mdx: string) => unknown;
}

const JSXElementRenderer = ({
  element,
  index,
  onUpdate,
}: JSXElementRendererProps) => {
  // Debounce the onUpdate callback for TiptapEditor updates (500ms delay)
  const debouncedOnUpdate = useDebounce(onUpdate, 500);

  const {
    value: { name, keyedAttributes, expressionAttributes, childrenMdx },
  } = element;

  const parentMdxWithInterceptedChildren = useMemo(() => {
    return buildMdxElement(
      name,
      keyedAttributes,
      expressionAttributes,
      "<InterceptedChildren />"
    );
  }, [name, keyedAttributes, expressionAttributes]);

  let children: React.ReactElement;

  if (element.value.richTextContent) {
    const html = mdxToHtml(element.value.childrenMdx);
    children = (
      <TiptapEditor
        autofocus={false}
        initialContent={html.html}
        disableDragging={element.value.contentDraggingDisabled}
        className="px-4"
        onUpdate={({ editor }) => {
          const html = editor.getHTML();
          const mdx = htmlToMdx(html);
          const indentedMdx = applyIndentation(mdx.mdx, 1);
          const finalMdx = buildMdxElement(
            name,
            keyedAttributes,
            expressionAttributes,
            indentedMdx
          );
          debouncedOnUpdate(finalMdx);
        }}
      />
    );
  } else {
    children = (
      <FernEditorMDXRendererInternal
        mdx={childrenMdx}
        onUpdate={(mdx) => {
          const indentedMdx = applyIndentation(mdx, 1);
          const finalMdx = buildMdxElement(
            name,
            keyedAttributes,
            expressionAttributes,
            indentedMdx
          );
          onUpdate(finalMdx);
        }}
      />
    );
  }

  return (
    <EditorComponentProvider
      isWithinEditor
      index={index}
      providedChildren={children}
      keyedAttributes={keyedAttributes}
      updateKeyedAttributes={(cb) => {
        const newAttributes = cb(keyedAttributes);

        const newElement = buildMdxElement(
          name,
          newAttributes,
          expressionAttributes,
          childrenMdx
        );

        onUpdate(newElement);
      }}
      appendChildrenMdx={(newChild) => {
        const newElement = buildMdxElement(
          name,
          keyedAttributes,
          expressionAttributes,
          childrenMdx + "\n" + newChild
        );

        onUpdate(newElement);
      }}
      deleteSelf={() => {
        onUpdate("");
      }}
    >
      <MDXRenderer mdx={parentMdxWithInterceptedChildren} />
    </EditorComponentProvider>
  );
};

// Renderer for parsed markdown elements
interface ParsedElementRendererProps {
  element: ParsedMarkdownElement;
  index: number;
  onUpdate: (mdx: string) => unknown;
}

const ParsedElementRenderer = ({
  element,
  index,
  onUpdate,
}: ParsedElementRendererProps) => {
  if (element.type === "terminalElement") {
    return <MDXRenderer mdx={element.originalMdx} />;
  }

  return (
    <JSXElementRenderer index={index} element={element} onUpdate={onUpdate} />
  );
};

const FernEditorMDXRendererInternal = ({
  mdx,
  onUpdate,
}: FernEditorMDXRendererProps) => {
  const deleteCounter = useRef(0);
  const parsed = useMemo(() => parseMDX(mdx), [mdx]);

  // Keep track of the MDX for each element
  const elementMdxMap = useMemo(() => {
    const initialMap = new Map<number, string>();
    parsed.forEach((element, index) => {
      if (element.type === "terminalElement") {
        initialMap.set(index, element.originalMdx);
      } else {
        // For JSX elements, start with the parent MDX with <InterceptedChildren /> replaced with children
        const initialMdx = buildMdxElement(
          element.value.name,
          element.value.keyedAttributes,
          element.value.expressionAttributes,
          element.value.childrenMdx
        );
        initialMap.set(index, initialMdx);
      }
    });
    return initialMap;
  }, [parsed]);

  const handleChildUpdate = (index: number, updatedMdx: string) => {
    const newMap = new Map(elementMdxMap);

    if (updatedMdx === "") {
      newMap.delete(index);
      deleteCounter.current += 1;
    } else {
      newMap.set(index, updatedMdx);
    }

    // Reconstruct the full MDX from all elements
    const fullMdx = Array.from(newMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, elementMdx]) => elementMdx)
      .join("\n");
    onUpdate(fullMdx);
  };

  return parsed.map((element, index) => (
    <ParsedElementRenderer
      key={`${index}_${deleteCounter.current}`}
      index={index}
      element={element}
      onUpdate={(updatedMdx) => handleChildUpdate(index, updatedMdx)}
    />
  ));
};

// Helper function to apply proper indentation to MDX content
function applyIndentation(mdx: string, indentLevel: number): string {
  if (indentLevel === 0) return mdx;

  const indent = "  ".repeat(indentLevel);
  return mdx
    .split("\n")
    .map((line, index, lines) => {
      // Don't indent empty lines
      if (!line.trim()) return "";

      // Don't indent the first line if it's an opening tag
      if (index === 0 && line.trim().startsWith("<")) {
        return line;
      }

      // Don't indent the last line if it's a closing tag
      if (index === lines.length - 1 && line.trim().startsWith("</")) {
        return line;
      }

      return indent + line;
    })
    .join("\n")
    .trim();
}
const FernEditorMDXRenderer = ({
  mdx,
  onUpdate,
}: FernEditorMDXRendererProps) => {
  return <FernEditorMDXRendererInternal mdx={mdx} onUpdate={onUpdate} />;
};

export default FernEditorMDXRenderer;
export { parseMDX };
