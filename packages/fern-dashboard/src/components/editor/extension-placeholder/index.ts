import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Node types that should always show placeholders (showOnlyCurrent: false)
const ALWAYS_SHOW_PLACEHOLDER_TYPES = new Set([
    "heading",
    "bulletList",
    "orderedList",
    "taskList",
    "listItem",
    "taskItem"
]);

/**
 * Custom placeholder extension that implements conditional showOnlyCurrent behavior per node type.
 *
 * For headings and lists: showOnlyCurrent = false (always show placeholder)
 * For other nodes (paragraphs, etc.): showOnlyCurrent = true (show only when focused)
 */
export const ConditionalPlaceholder = Placeholder.extend({
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey("conditionalPlaceholder"),
                props: {
                    decorations: ({ doc, selection }) => {
                        const active = this.editor.isEditable || !this.options.showOnlyWhenEditable;
                        if (!active) {
                            return DecorationSet.empty;
                        }

                        const decorations: Decoration[] = [];
                        const { anchor } = selection;

                        doc.descendants((node, pos) => {
                            const hasAnchor = anchor >= pos && anchor < pos + node.nodeSize;
                            const isEmpty = !node.isLeaf && !node.childCount;

                            if (!isEmpty) {
                                return;
                            }

                            const shouldAlwaysShow = ALWAYS_SHOW_PLACEHOLDER_TYPES.has(node.type.name);

                            // Show placeholder if:
                            // 1. Node type should always show (headings, lists), OR
                            // 2. This is the currently focused node (hasAnchor)
                            if (shouldAlwaysShow || hasAnchor) {
                                const placeholderText =
                                    typeof this.options.placeholder === "function"
                                        ? this.options.placeholder({
                                              editor: this.editor,
                                              node,
                                              pos,
                                              hasAnchor
                                          })
                                        : this.options.placeholder;

                                if (placeholderText) {
                                    decorations.push(
                                        Decoration.node(pos, pos + node.nodeSize, {
                                            class: this.options.emptyNodeClass,
                                            "data-placeholder": placeholderText
                                        })
                                    );
                                }
                            }
                        });

                        return DecorationSet.create(doc, decorations);
                    }
                }
            })
        ];
    }
});
