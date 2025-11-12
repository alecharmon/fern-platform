import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { InlineCustomElementNodeView } from "./InlineCustomElementNodeView";

/**
 * The tag name for the inline custom element node. Also used as the node name.
 */
const TAG = "custom-inline-element-v2";

export interface InlineCustomElementOptions {
    /**
     * The HTML attributes for an inline custom element node.
     * @default {}
     * @example { class: 'foo' }
     */
    HTMLAttributes: Record<string, any>;
}

/**
 * This extension allows you to create inline custom elements that can appear within paragraphs.
 * Unlike the block CustomElement, these render inline with text content.
 */
export const InlineCustomElement = Node.create<InlineCustomElementOptions>({
    name: TAG,

    group: "inline",

    inline: true,

    atom: true,

    draggable: false,

    selectable: true,

    /**
     * The data attributes are used to store the original content of the custom element.
     * @example <custom-inline-element-v2 data-hash="..." data-type="..." data-name="..." />
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
        return ReactNodeViewRenderer(InlineCustomElementNodeView, {
            as: "span",
            attrs: ({ node }) => ({
                ...node.attrs,
                class: "node-custom-inline-element-v2 inline-flex w-auto align-middle"
            })
        });
    },

    parseHTML() {
        return [{ tag: TAG }];
    },

    renderHTML({ HTMLAttributes }) {
        return [TAG, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    }
});
