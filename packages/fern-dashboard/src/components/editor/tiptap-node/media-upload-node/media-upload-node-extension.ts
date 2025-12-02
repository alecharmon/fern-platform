import type { NodeType } from "@tiptap/pm/model";
import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";

import { MediaUploadNode as MediaUploadNodeComponent } from "@/components/editor/tiptap-node/media-upload-node/media-upload-node";

/**
 * This file is boilerplate from Tiptap's image-upload-node.
 */
export type UploadFunction = (
    file: File,
    onProgress?: (event: { progress: number }) => void,
    abortSignal?: AbortSignal
) => Promise<string>;

export interface MediaUploadNodeOptions {
    /**
     * The type of the node.
     * @default 'image'
     */
    type?: string | NodeType | undefined;
    /**
     * The media type to upload (image, video, or auto for both).
     * @default 'auto'
     */
    mediaType?: "image" | "video" | "auto";
    /**
     * Acceptable file types for upload.
     * @default 'image/*,video/*'
     */
    accept?: string;
    /**
     * Maximum number of files that can be uploaded.
     * @default 1
     */
    limit?: number;
    /**
     * Maximum file size in bytes (0 for unlimited).
     * @default 0
     */
    maxSize?: number;
    /**
     * Function to handle the upload process.
     */
    upload?: UploadFunction;
    /**
     * Callback for upload errors.
     */
    onError?: (error: Error) => void;
    /**
     * Callback for successful uploads.
     */
    onSuccess?: (url: string) => void;
    /**
     * HTML attributes to add to the image element.
     * @default {}
     * @example { class: 'foo' }
     */

    HTMLAttributes?: Record<string, any>;
}

declare module "@tiptap/react" {
    interface Commands<ReturnType> {
        mediaUpload: {
            setMediaUploadNode: (options?: MediaUploadNodeOptions) => ReturnType;
        };
    }
}

/**
 * A Tiptap node extension that creates an image upload component.
 * @see registry/tiptap-node/image-upload-node/image-upload-node
 */
export const MediaUploadNode = Node.create<MediaUploadNodeOptions>({
    name: "mediaUpload",

    group: "block",

    draggable: true,

    atom: true,

    addOptions() {
        return {
            type: "media",
            mediaType: "auto",
            accept: "image/*,video/*",
            limit: 1,
            maxSize: 0,
            upload: undefined,
            onError: undefined,
            onSuccess: undefined,
            HTMLAttributes: {}
        };
    },

    addAttributes() {
        return {
            mediaType: {
                default: this.options.mediaType
            },
            accept: {
                default: this.options.accept
            },
            limit: {
                default: this.options.limit
            },
            maxSize: {
                default: this.options.maxSize
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="image-upload"]',
                getAttrs: () => ({ mediaType: "image" })
            },
            {
                tag: 'div[data-type="video-upload"]',
                getAttrs: () => ({ mediaType: "video" })
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const mediaType = (HTMLAttributes.mediaType ?? "auto") as "image" | "video" | "auto";
        const dataType = mediaType === "video" ? "video-upload" : "image-upload";
        return ["div", mergeAttributes({ "data-type": dataType }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MediaUploadNodeComponent);
    },

    addCommands() {
        return {
            setMediaUploadNode:
                (options) =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: options
                    });
                }
        };
    },

    /**
     * Adds Enter key handler to trigger the upload component when it's selected.
     */
    addKeyboardShortcuts() {
        return {
            Enter: ({ editor }) => {
                const { selection } = editor.state;
                const { nodeAfter } = selection.$from;

                if (nodeAfter && nodeAfter.type.name === "mediaUpload" && editor.isActive("mediaUpload")) {
                    const nodeEl = editor.view.nodeDOM(selection.$from.pos);
                    if (nodeEl && nodeEl instanceof HTMLElement) {
                        // Since NodeViewWrapper is wrapped with a div, we need to click the first child
                        const firstChild = nodeEl.firstChild;
                        if (firstChild && firstChild instanceof HTMLElement) {
                            firstChild.click();
                            return true;
                        }
                    }
                }
                return false;
            }
        };
    }
});

export default MediaUploadNode;
