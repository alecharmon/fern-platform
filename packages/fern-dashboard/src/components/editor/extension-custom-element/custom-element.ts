import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { CustomElementNodeView } from "./CustomElementNodeView";

/**
 * The tag name for the custom element node. Also used as the node name and the plugin key.
 */
const TAG = "custom-element-v2";

export interface CustomElementOptions {
    /**
     * The HTML attributes for a custom element node.
     * @default {}
     * @example { class: 'foo' }
     */
    HTMLAttributes: Record<string, any>;
}

/**
 * This extension allows you to create custom elements.
 */
export const CustomElement = Node.create<CustomElementOptions>({
    name: TAG,

    group: "block",

    content: "text*",

    atom: true,

    draggable: true,

    selectable: true,

    /**
     * The data attributes are used to store the original content of the custom element.
     * @example <custom-element data-hash="..." data-type="..." data-name="..." />
     */
    addAttributes() {
        return {
            "fve-data-id": {
                default: null
            },
            "fve-mdx-b64": {
                default: null
            },
            "fve-newly-created": {
                default: false
            },
            /**
             * Set contenteditable to false to prevent the custom element from being edited.
             */
            contenteditable: {
                default: false
            }
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(CustomElementNodeView, {
            as: "custom-element-v2",
            attrs: ({ node }) => ({
                ...node.attrs
            })
        });
    },

    parseHTML() {
        return [{ tag: TAG }];
    },

    renderHTML({ HTMLAttributes }) {
        return [TAG, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey(TAG + "-deletion-handler"),
                props: {
                    handleKeyDown(view, event) {
                        // Handle delete and backspace keys
                        if (event.key === "Delete" || event.key === "Backspace") {
                            const { state } = view;
                            const { selection } = state;

                            // Find custom elements in the selection range
                            let customElementPos = -1;
                            let customElementNode = null;

                            if (event.key === "Delete") {
                                // For Delete key, check what's immediately after the cursor
                                // But also check if we're at the start of a text node after a custom element
                                const pos = selection.from;
                                let nodeToCheck = state.doc.nodeAt(pos);
                                let posToCheck = pos;

                                if (!nodeToCheck || nodeToCheck.type.name !== TAG) {
                                    // If not directly on a custom element, check the previous node
                                    // This handles the case where cursor is at start of paragraph after custom element
                                    const resolvedPos = state.doc.resolve(pos);
                                    const prevNode = resolvedPos.nodeBefore;
                                    if (prevNode && prevNode.type.name === TAG) {
                                        nodeToCheck = prevNode;
                                        posToCheck = pos - prevNode.nodeSize;
                                    }
                                }

                                if (nodeToCheck && nodeToCheck.type.name === TAG) {
                                    customElementPos = posToCheck;
                                    customElementNode = nodeToCheck;
                                }
                            } else if (event.key === "Backspace") {
                                // For Backspace key, check what's immediately before the cursor
                                const pos = selection.from;
                                const resolvedPos = state.doc.resolve(pos);
                                const prevNode = resolvedPos.nodeBefore;

                                if (prevNode && prevNode.type.name === TAG) {
                                    customElementPos = pos - prevNode.nodeSize;
                                    customElementNode = prevNode;
                                }
                            }

                            if (customElementPos !== -1 && customElementNode) {
                                // Check if the custom element is currently selected
                                const isSelectedNode =
                                    selection instanceof NodeSelection && selection.from === customElementPos;

                                if (!isSelectedNode) {
                                    return true; // Prevent default delete behavior
                                }
                                // If already selected, allow deletion by not preventing default
                            }
                        }
                        return false;
                    }
                }
            }),
            new Plugin({
                key: new PluginKey(TAG),
                /**
                 * This plugin is used to prevent the custom element node from being replaced (deleted).
                 * However, it allows setContent operations (full document replacements) to proceed.
                 * @see https://github.com/ueberdosis/tiptap/issues/181#issuecomment-1213455982
                 */
                filterTransaction(transaction, state) {
                    // Allow transactions that replace the entire document (setContent operations)
                    if (transaction.steps.length === 1 && transaction.steps[0] instanceof ReplaceStep) {
                        const step = transaction.steps[0] as ReplaceStep;
                        // If the step replaces from position 0 to the end of the document, it's likely a setContent
                        if (step.from === 0 && step.to === state.doc.content.size) {
                            return true;
                        }
                    }

                    // Check if any step involves a custom element
                    let hasCustomElement = false;
                    transaction.steps.forEach((step) => {
                        if (step instanceof ReplaceStep) {
                            state.doc.nodesBetween(step.from, step.to, (node) => {
                                if (node.type.name === TAG) {
                                    hasCustomElement = true;
                                }
                            });
                        }
                    });

                    // If no custom elements are involved, allow the transaction
                    if (!hasCustomElement) {
                        return true;
                    }

                    // Check if this is a drag operation (remove + insert pattern)
                    const replaceSteps = transaction.steps.filter(
                        (step) => step instanceof ReplaceStep
                    ) as ReplaceStep[];

                    if (replaceSteps.length === 2) {
                        const [removeStep, insertStep] = replaceSteps;

                        // Check if this looks like a drag operation:
                        // - One step removes content (slice size 0, from !== to)
                        // - Another step inserts content (slice size > 0, from === to)
                        const hasRemovalStep =
                            removeStep?.slice?.content?.size === 0 && removeStep?.from !== removeStep?.to;
                        const hasInsertionStep =
                            !!insertStep?.slice?.content?.size && insertStep?.from === insertStep?.to;

                        if (hasRemovalStep && hasInsertionStep) {
                            return true;
                        }
                    }

                    // For other transactions involving custom elements, only allow deletion of selected nodes
                    let result = true;
                    const hasInsertion = replaceSteps.some((step) => step.slice.content.size > 0);

                    transaction.steps.forEach((step) => {
                        if (step instanceof ReplaceStep) {
                            const isDeletion = step.slice.content.size === 0 && step.from !== step.to;
                            if (isDeletion && !hasInsertion) {
                                // Check if a custom element is being deleted
                                state.doc.nodesBetween(step.from, step.to, (node, pos) => {
                                    if (node.type.name === TAG) {
                                        // Check if the custom element is currently selected
                                        const { selection } = state;
                                        const isSelectedNode =
                                            selection instanceof NodeSelection && selection.from === pos;

                                        if (!isSelectedNode) {
                                            // Block deletion if the custom element is not selected
                                            result = false;
                                        }
                                    }
                                });
                            }
                        }
                    });
                    return result;
                }
            })
        ];
    }
});
