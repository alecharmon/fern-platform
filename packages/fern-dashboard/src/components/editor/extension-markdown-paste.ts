import { mdxToHtml } from "@fern-docs/mdx";
import { Extension } from "@tiptap/core";
import { DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

function looksLikeMarkdown(text: string): boolean {
    const trimmed = text.trim();
    return (
        trimmed.startsWith("#") || // Headings
        /^[-*+]\s/.test(trimmed) || // Unordered lists
        /^\d+\.\s/.test(trimmed) || // Ordered lists
        /^```/.test(trimmed) || // Code blocks
        /^>/.test(trimmed) || // Blockquotes
        /\[.+\]\(.+\)/.test(trimmed) // Links
    );
}

export const MarkdownPasteExtension = Extension.create({
    name: "markdownPaste",

    addProseMirrorPlugins() {
        let forcePlainTextNextPaste = false;

        return [
            new Plugin({
                key: new PluginKey("markdownPaste"),
                props: {
                    handleKeyDown: (view, event) => {
                        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "v") {
                            forcePlainTextNextPaste = true;
                        }
                        return false;
                    },
                    handlePaste: (view, event) => {
                        const clipboardData = event.clipboardData;
                        if (!clipboardData) {
                            return false;
                        }

                        const types = Array.from(clipboardData.types);
                        if (types.includes("text/x-prosemirror-slice")) {
                            return false;
                        }

                        const text = clipboardData.getData("text/plain");
                        const html = clipboardData.getData("text/html");

                        if (forcePlainTextNextPaste) {
                            forcePlainTextNextPaste = false;
                            if (text) {
                                event.preventDefault();
                                const { tr } = view.state;
                                tr.insertText(text);
                                view.dispatch(tr);
                                return true;
                            }
                            return false;
                        }

                        const shouldTreatAsMarkdown = text && (!html || looksLikeMarkdown(text));

                        if (!shouldTreatAsMarkdown) {
                            return false;
                        }

                        try {
                            const { html: convertedHtml } = mdxToHtml(text);

                            if (convertedHtml) {
                                event.preventDefault();
                                const tempDiv = document.createElement("div");
                                tempDiv.innerHTML = convertedHtml;

                                const parser = PMDOMParser.fromSchema(view.state.schema);
                                const parsedSlice = parser.parseSlice(tempDiv);

                                if (parsedSlice) {
                                    const { tr } = view.state;
                                    tr.replaceSelection(parsedSlice);
                                    view.dispatch(tr);
                                    return true;
                                }
                            }
                        } catch {
                            event.preventDefault();
                            const { tr } = view.state;
                            tr.insertText(text);
                            view.dispatch(tr);
                            return true;
                        }

                        return false;
                    }
                }
            })
        ];
    }
});
