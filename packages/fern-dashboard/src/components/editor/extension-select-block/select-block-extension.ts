import { Extension } from "@tiptap/core";

/**
 * Extension that overrides CMD+A (Mod-a) to select only the current block content
 * instead of the entire document. This applies to all block types including
 * paragraphs, headings, code blocks, list items, etc.
 */
export const SelectBlockExtension = Extension.create({
    name: "selectBlock",

    addKeyboardShortcuts() {
        return {
            "Mod-a": ({ editor }) => {
                const { selection } = editor.state;
                const { $from } = selection;

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
