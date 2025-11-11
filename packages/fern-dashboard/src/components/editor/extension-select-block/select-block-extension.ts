import { Extension } from "@tiptap/core";

/**
 * Extension that overrides CMD+A (Mod-a) to select only the current block content
 * instead of the entire document. This applies to all block types including
 * paragraphs, headings, code blocks, list items, etc.
 *
 * If CMD+A is pressed twice in succession (within 500ms), it selects the entire page.
 */
export const SelectBlockExtension = Extension.create({
    name: "selectBlock",
    priority: 1000,

    addStorage() {
        return {
            lastSelectAllTime: 0
        };
    },

    addKeyboardShortcuts() {
        return {
            "Mod-a": ({ editor }) => {
                const now = Date.now();
                const timeSinceLastPress = now - this.storage.lastSelectAllTime;
                const doubleSelectThreshold = 500; // milliseconds

                if (timeSinceLastPress < doubleSelectThreshold) {
                    this.storage.lastSelectAllTime = 0; // Reset timer
                    editor.commands.selectAll();
                    return true;
                }

                this.storage.lastSelectAllTime = now;

                const { selection } = editor.state;
                const { $from } = selection;

                // If inside a table cell, defer to Table extension for single-press behavior
                for (let depth = $from.depth; depth > 0; depth--) {
                    const node = $from.node(depth);
                    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                        return false;
                    }
                }

                for (let depth = $from.depth; depth > 0; depth--) {
                    const node = $from.node(depth);
                    const nodeType = node.type.name;

                    if (
                        nodeType === "paragraph" ||
                        nodeType === "heading" ||
                        nodeType === "codeBlock" ||
                        nodeType === "blockquote" ||
                        nodeType === "listItem" ||
                        nodeType === "custom-element-v2"
                    ) {
                        const blockStart = $from.start(depth);
                        const blockEnd = $from.end(depth);

                        editor.commands.setTextSelection({
                            from: blockStart,
                            to: blockEnd
                        });

                        return true; // Prevent default behavior
                    }
                }

                return false;
            }
        };
    }
});
