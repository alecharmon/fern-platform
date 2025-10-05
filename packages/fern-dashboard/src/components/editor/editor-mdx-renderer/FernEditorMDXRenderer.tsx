import React, { useEffect, useMemo, useRef, useState } from "react";

import { useMDXComponents } from "@mdx-js/react";
import { getMDXComponent } from "mdx-bundler/client";

import {
    type MdastNodes,
    type MdxJsxAttribute,
    type MdxJsxExpressionAttribute,
    astToMDX,
    htmlToMdx,
    mdxToHtml
} from "@fern-docs/mdx";

import TiptapEditor from "@/components/editor/TiptapEditor";
import { EditorComponentChildrenProvider } from "@/components/editor/editor-component/EditorComponentChildrenContext";
import { EditorComponentProvider } from "@/components/editor/editor-component/EditorComponentContext";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/docs/components/error-boundary";
import { useDebounce } from "@/hooks/useDebounce";
import type { EncodedDocsUrl } from "@/utils/types";

import { UnsupportedContent } from "../UnsupportedContent";
import { cachedBundleMDX } from "./cache";
import { parseMDX } from "./parse";
import type { AttributeValue, JSXElement, ParsedMarkdownElement } from "./types";

function buildMdxElement(
    name: string,
    keyedAttributes: Record<string, AttributeValue>,
    expressionAttributes: (MdxJsxAttribute | MdxJsxExpressionAttribute)[],
    childrenMdx?: string
): string {
    // If there are no children, render as a self-closing element
    if (childrenMdx == null) {
        const element: MdastNodes = {
            type: "mdxJsxTextElement",
            name,
            attributes: [
                ...Object.entries(keyedAttributes).map(
                    ([key, value]): MdxJsxAttribute =>
                        value.type === "string"
                            ? {
                                  type: "mdxJsxAttribute" as const,
                                  name: key,
                                  value: value.value
                              }
                            : {
                                  type: "mdxJsxAttribute" as const,
                                  name: key,
                                  value: {
                                      type: "mdxJsxAttributeValueExpression",
                                      value: value.rawStringValue
                                  }
                              }
                ),
                ...expressionAttributes
            ],
            children: []
        };
        const mdxElem = astToMDX(element);
        return mdxElem;
    }

    // Otherwise, render as a flow element with children
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
                              value: value.value
                          }
                        : {
                              type: "mdxJsxAttribute" as const,
                              name: key,
                              value: {
                                  type: "mdxJsxAttributeValueExpression",
                                  value: value.rawStringValue
                              }
                          }
            ),
            ...expressionAttributes
        ],
        children: [
            {
                type: "mdxJsxFlowElement",
                name: placeholder,
                attributes: [],
                children: []
            }
        ]
    };

    const initial = astToMDX(element);
    const final = initial.replace(`<${placeholder} />`, childrenMdx);
    return final;
}

interface FernEditorMDXRendererProps {
    mdx: string;
    onUpdate: (mdx: string) => unknown;
    newlyCreated?: boolean;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
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

// Loading component for terminal elements
const LoadingTerminalElement = React.memo(() => <Skeleton className="my-2 h-16 w-full" />);
LoadingTerminalElement.displayName = "LoadingTerminalElement";

// MDX renderer component for terminal elements
interface TerminalMDXRendererProps {
    code: string;
    components: ReturnType<typeof useMDXComponents>;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

const TerminalMDXRenderer = React.memo(({ code, components }: TerminalMDXRendererProps) => {
    const MDXComponent = useMemo(() => {
        try {
            return getMDXComponent(code);
        } catch (error) {
            console.warn("[TerminalMDXRenderer] Failed to create MDX component:", error);
            throw error;
        }
    }, [code]);

    return <MDXComponent components={components} />;
});
TerminalMDXRenderer.displayName = "TerminalMDXRenderer";

// Terminal element renderer with bundling logic
interface MDXRendererProps {
    mdx: string;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

const MDXRenderer = React.memo(({ mdx, docsUrl, branch }: MDXRendererProps) => {
    const [state, setState] = useState<MDXRendererState>({
        type: "BUNDLING"
    });
    const components = useMDXComponents();

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const result = await cachedBundleMDX(mdx, { docsUrl, branch });
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
    }, [mdx, docsUrl, branch]);

    if (state.type === "BUNDLING") {
        return <LoadingTerminalElement />;
    }

    if (state.type === "ERROR") {
        return (
            <UnsupportedContent>
                {!mdx.includes("<InterceptedChildren />") ? mdx : "Unsupported markdown"}
            </UnsupportedContent>
        );
    }

    return (
        <ErrorBoundary
            fallback={
                <UnsupportedContent>
                    {!mdx.includes("<InterceptedChildren />") ? mdx : "Unsupported markdown"}
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
    newlyCreated?: boolean;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

const JSXElementRenderer = ({ element, index, onUpdate, newlyCreated, docsUrl, branch }: JSXElementRendererProps) => {
    // Debounce the onUpdate callback for TiptapEditor updates (500ms delay)
    const debouncedOnUpdate = useDebounce(onUpdate, 500);

    const {
        value: { name, keyedAttributes, expressionAttributes, children: jsxChildren }
    } = element;

    const parentMdx = useMemo(() => {
        return buildMdxElement(
            name,
            keyedAttributes,
            expressionAttributes,
            jsxChildren.type === "DISALLOWED" ? undefined : "<InterceptedChildren />"
        );
    }, [name, keyedAttributes, expressionAttributes, jsxChildren]);

    let children: React.ReactElement | undefined;

    if (jsxChildren.type === "RICH_TEXT") {
        const html = mdxToHtml(jsxChildren.childrenMdx);
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
                    const finalMdx = buildMdxElement(name, keyedAttributes, expressionAttributes, indentedMdx);
                    debouncedOnUpdate(finalMdx);
                }}
            />
        );
    } else if (jsxChildren.type === "ALLOWED") {
        children = (
            <FernEditorMDXRendererInternal
                mdx={jsxChildren.childrenMdx}
                docsUrl={docsUrl}
                branch={branch}
                onUpdate={(mdx) => {
                    const indentedMdx = applyIndentation(mdx, 1);
                    const finalMdx = buildMdxElement(name, keyedAttributes, expressionAttributes, indentedMdx);
                    onUpdate(finalMdx);
                }}
            />
        );
    }

    // Outer provider: EditorComponentProvider (no providedChildren/appendChildrenMdx here)
    // Inner provider: EditorComponentChildrenProvider (only if childrenType !== "DISALLOWED")
    return (
        <EditorComponentProvider
            isWithinEditor
            index={index}
            keyedAttributes={keyedAttributes}
            updateKeyedAttributes={(cb) => {
                const newAttributes = cb(keyedAttributes);

                const newElement = buildMdxElement(
                    name,
                    newAttributes,
                    expressionAttributes,
                    jsxChildren.type === "DISALLOWED" ? undefined : jsxChildren.childrenMdx
                );

                onUpdate(newElement);
            }}
            deleteSelf={() => {
                onUpdate("");
            }}
            newlyCreated={newlyCreated}
        >
            {jsxChildren.type !== "DISALLOWED" ? (
                <EditorComponentChildrenProvider
                    appendChildrenMdx={(newChild: string) => {
                        const newElement = buildMdxElement(
                            name,
                            keyedAttributes,
                            expressionAttributes,
                            (jsxChildren.childrenMdx ? jsxChildren.childrenMdx + "\n" : "") + newChild
                        );
                        onUpdate(newElement);
                    }}
                    providedChildren={children ?? <></>}
                >
                    <MDXRenderer mdx={parentMdx} docsUrl={docsUrl} branch={branch} />
                </EditorComponentChildrenProvider>
            ) : (
                <MDXRenderer mdx={parentMdx} docsUrl={docsUrl} branch={branch} />
            )}
        </EditorComponentProvider>
    );
};
// Renderer for parsed markdown elements
interface ParsedElementRendererProps {
    element: ParsedMarkdownElement;
    index: number;
    onUpdate: (mdx: string) => unknown;
    newlyCreated?: boolean;
    docsUrl?: EncodedDocsUrl;
    branch?: string;
}

const ParsedElementRenderer = ({
    element,
    index,
    onUpdate,
    newlyCreated,
    docsUrl,
    branch
}: ParsedElementRendererProps) => {
    if (element.type === "terminalElement") {
        return <MDXRenderer mdx={element.originalMdx} docsUrl={docsUrl} branch={branch} />;
    }

    return (
        <JSXElementRenderer
            index={index}
            element={element}
            onUpdate={onUpdate}
            newlyCreated={newlyCreated}
            docsUrl={docsUrl}
            branch={branch}
        />
    );
};

const FernEditorMDXRendererInternal = ({
    mdx,
    onUpdate,
    newlyCreated,
    docsUrl,
    branch
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
                    element.value.children.type === "DISALLOWED" ? undefined : element.value.children.childrenMdx
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
            newlyCreated={newlyCreated}
            docsUrl={docsUrl}
            branch={branch}
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
const FernEditorMDXRenderer = ({ mdx, onUpdate, newlyCreated, docsUrl, branch }: FernEditorMDXRendererProps) => {
    return (
        <FernEditorMDXRendererInternal
            mdx={mdx}
            onUpdate={onUpdate}
            newlyCreated={newlyCreated}
            docsUrl={docsUrl}
            branch={branch}
        />
    );
};

export default FernEditorMDXRenderer;
