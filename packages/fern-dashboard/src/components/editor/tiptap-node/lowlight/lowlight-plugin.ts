import { findChildren } from "@tiptap/core";
import type { Node as ProsemirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { LowlightInstance } from "../../extension-code-block/types";

function parseNodes(nodes: any[], className: string[] = []): { text: string; classes: string[] }[] {
    return nodes
        .map((node) => {
            const classes = [...className, ...(node.properties ? node.properties.className : [])];

            if (node.children) {
                return parseNodes(node.children, classes);
            }

            return {
                text: node.value,
                classes
            };
        })
        .flat();
}

function getHighlightNodes(result: any) {
    // `.value` for lowlight v1, `.children` for lowlight v2
    return result.value || result.children || [];
}

function registered(aliasOrLanguage: string, lowlight: LowlightInstance) {
    return Boolean(lowlight.registered(aliasOrLanguage));
}

function getDecorations({
    doc,
    name,
    lowlight,
    defaultLanguage
}: {
    doc: ProsemirrorNode;
    name: string;
    lowlight: any;
    defaultLanguage: string | null | undefined;
}) {
    const decorations: Decoration[] = [];

    findChildren(doc, (node) => node.type.name === name).forEach((block) => {
        let from = block.pos + 1;
        const language = block.node.attrs.language || defaultLanguage;
        const languages = lowlight.listLanguages();

        const nodes =
            language &&
            (languages.includes(language) || registered(language, lowlight) || lowlight.registered?.(language))
                ? getHighlightNodes(lowlight.highlight(language, block.node.textContent))
                : getHighlightNodes(lowlight.highlightAuto(block.node.textContent));

        parseNodes(nodes).forEach((node) => {
            const to = from + node.text.length;

            if (node.classes.length) {
                const decoration = Decoration.inline(from, to, {
                    class: node.classes.join(" ")
                });

                decorations.push(decoration);
            }

            from = to;
        });
    });

    return DecorationSet.create(doc, decorations);
}

export function LowlightPlugin({
    name,
    defaultLanguage,
    lowlight
}: {
    name: string;
    defaultLanguage: string | null | undefined;
    lowlight: LowlightInstance;
}) {
    // @ts-expect-error use of any
    const lowlightPlugin = new Plugin<any>({
        key: new PluginKey("lowlight"),

        state: {
            init: (_, { doc }) =>
                getDecorations({
                    doc,
                    name,
                    lowlight,
                    defaultLanguage
                }),
            apply: (transaction, decorationSet, oldState, newState) => {
                const oldNodeName = oldState.selection.$head.parent.type.name;
                const newNodeName = newState.selection.$head.parent.type.name;
                const oldNodes = findChildren(oldState.doc, (node) => node.type.name === name);
                const newNodes = findChildren(newState.doc, (node) => node.type.name === name);

                if (
                    transaction.docChanged &&
                    // Apply decorations if:
                    // selection includes named node,
                    ([oldNodeName, newNodeName].includes(name) ||
                        // OR transaction adds/removes named node,
                        newNodes.length !== oldNodes.length ||
                        // OR transaction has changes that completely encapsulte a node
                        // (for example, a transaction that affects the entire document).
                        // Such transactions can happen during collab syncing via y-prosemirror, for example.
                        transaction.steps.some((step) => {
                            return (
                                // @ts-expect-error misc type issue from tiptap
                                step.from !== undefined &&
                                // @ts-expect-error misc type issue from tiptap
                                step.to !== undefined &&
                                oldNodes.some((node) => {
                                    return (
                                        // @ts-expect-error misc type issue from tiptap
                                        node.pos >= step.from &&
                                        // @ts-expect-error misc type issue from tiptap
                                        node.pos + node.node.nodeSize <= step.to
                                    );
                                })
                            );
                        }))
                ) {
                    return getDecorations({
                        doc: transaction.doc,
                        name,
                        lowlight,
                        defaultLanguage
                    });
                }

                return decorationSet.map(transaction.mapping, transaction.doc);
            }
        },

        props: {
            // @ts-expect-error misc type issue from tiptap
            decorations(state) {
                return lowlightPlugin.getState(state);
            }
        }
    });

    return lowlightPlugin;
}
