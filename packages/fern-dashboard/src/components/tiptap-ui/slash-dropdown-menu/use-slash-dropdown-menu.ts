"use client";

import type { Editor } from "@tiptap/react";
import {
    AtSign,
    Code,
    Heading1,
    Heading2,
    Heading3,
    Image,
    List,
    ListCheck,
    ListOrdered,
    MinusIcon,
    QuoteIcon,
    SmilePlus,
    Sparkles,
    Type
} from "lucide-react";
import * as React from "react";

// --- Icons ---

import { addEmojiTrigger } from "@/components/tiptap-ui/emoji-trigger-button";
import { addMentionTrigger } from "@/components/tiptap-ui/mention-trigger-button";
// --- Tiptap UI ---
import type { SuggestionItem } from "@/components/tiptap-ui-utils/suggestion-menu";
import { findSelectionPosition, hasContentAbove } from "@/utils/tiptap-advanced-utils";
// --- Lib ---
import { isExtensionAvailable, isNodeInSchema } from "@/utils/tiptap-utils";

export interface SlashMenuConfig {
    enabledItems?: SlashMenuItemType[];
    customItems?: SuggestionItem[];
    itemGroups?: Partial<Record<SlashMenuItemType, string>>;
    showGroups?: boolean;
}

const texts = {
    // AI
    continue_writing: {
        title: "Continue Writing",
        subtext: "Continue writing from the current position",
        keywords: ["continue", "write", "continue writing", "ai"],
        badge: Sparkles,
        group: "AI"
    },
    ai_ask_button: {
        title: "Ask AI",
        subtext: "Ask AI to generate content",
        keywords: ["ai", "ask", "generate"],
        badge: Sparkles,
        group: "AI"
    },

    // Style
    text: {
        title: "Text",
        subtext: "Regular text paragraph",
        keywords: ["p", "paragraph", "text"],
        badge: Type,
        group: "Style"
    },
    heading_1: {
        title: "Heading 1",
        subtext: "Top-level heading",
        keywords: ["h", "heading1", "h1"],
        badge: Heading1,
        group: "Style"
    },
    heading_2: {
        title: "Heading 2",
        subtext: "Key section heading",
        keywords: ["h2", "heading2", "subheading"],
        badge: Heading2,
        group: "Style"
    },
    heading_3: {
        title: "Heading 3",
        subtext: "Subsection and group heading",
        keywords: ["h3", "heading3", "subheading"],
        badge: Heading3,
        group: "Style"
    },
    bullet_list: {
        title: "Bullet List",
        subtext: "List with unordered items",
        keywords: ["ul", "li", "list", "bulletlist", "bullet list"],
        badge: List,
        group: "Style"
    },
    ordered_list: {
        title: "Numbered List",
        subtext: "List with ordered items",
        keywords: ["ol", "li", "list", "numberedlist", "numbered list"],
        badge: ListOrdered,
        group: "Style"
    },
    task_list: {
        title: "To-do list",
        subtext: "List with tasks",
        keywords: ["tasklist", "task list", "todo", "checklist"],
        badge: ListCheck,
        group: "Style"
    },
    quote: {
        title: "Blockquote",
        subtext: "Blockquote block",
        keywords: ["quote", "blockquote"],
        badge: QuoteIcon,
        group: "Style"
    },
    code_block: {
        title: "Code Block",
        subtext: "Code block with syntax highlighting",
        keywords: ["code", "pre"],
        badge: Code,
        group: "Style"
    },

    // Insert
    mention: {
        title: "Mention",
        subtext: "Mention a user or item",
        keywords: ["mention", "user", "item", "tag"],
        badge: AtSign,
        group: "Insert"
    },
    emoji: {
        title: "Emoji",
        subtext: "Insert an emoji",
        keywords: ["emoji", "emoticon", "smiley"],
        badge: SmilePlus,
        group: "Insert"
    },
    divider: {
        title: "Separator",
        subtext: "Horizontal line to separate content",
        keywords: ["hr", "horizontalRule", "line", "separator"],
        badge: MinusIcon,
        group: "Insert"
    },

    // Upload
    image: {
        title: "Image",
        subtext: "Resizable image with caption",
        keywords: ["image", "imageUpload", "upload", "img", "picture", "media", "url"],
        badge: Image,
        group: "Upload"
    }
};

export type SlashMenuItemType = keyof typeof texts;

const getItemImplementations = () => {
    return {
        // AI
        continue_writing: {
            check: (editor: Editor) => {
                const { hasContent } = hasContentAbove(editor);
                const extensionsReady = isExtensionAvailable(editor, ["ai", "aiAdvanced"]);
                return extensionsReady && hasContent;
            },
            action: ({ editor }: { editor: Editor }) => {
                const editorChain = editor.chain().focus();

                const nodeSelectionPosition = findSelectionPosition({ editor });

                if (nodeSelectionPosition != null) {
                    editorChain.setNodeSelection(nodeSelectionPosition);
                }

                editorChain.run();

                // editor.chain().focus().aiGenerationShow().run();

                // requestAnimationFrame(() => {
                //   const { hasContent, content } = hasContentAbove(editor);

                //   const snippet =
                //     content.length > 500 ? `...${content.slice(-500)}` : content;

                //   const prompt = hasContent
                //     ? `Context: ${snippet}\n\nContinue writing from where the text above ends. Write ONLY ONE SENTENCE. DONT REPEAT THE TEXT.`
                //     : "Start writing a new paragraph. Write ONLY ONE SENTENCE.";

                //   editor
                //     .chain()
                //     .focus()
                //     .aiTextPrompt({
                //       stream: true,
                //       format: "rich-text",
                //       text: prompt,
                //     })
                //     .run();
                // });
            }
        },
        ai_ask_button: {
            check: (editor: Editor) => isExtensionAvailable(editor, ["ai", "aiAdvanced"]),
            action: ({ editor }: { editor: Editor }) => {
                const editorChain = editor.chain().focus();

                const nodeSelectionPosition = findSelectionPosition({ editor });

                if (nodeSelectionPosition != null) {
                    editorChain.setNodeSelection(nodeSelectionPosition);
                }

                editorChain.run();

                // editor.chain().focus().aiGenerationShow().run();
            }
        },

        // Style
        text: {
            check: (editor: Editor) => isNodeInSchema("paragraph", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().setParagraph().run();
            }
        },
        heading_1: {
            check: (editor: Editor) => isNodeInSchema("heading", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleHeading({ level: 1 }).run();
            }
        },
        heading_2: {
            check: (editor: Editor) => isNodeInSchema("heading", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleHeading({ level: 2 }).run();
            }
        },
        heading_3: {
            check: (editor: Editor) => isNodeInSchema("heading", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleHeading({ level: 3 }).run();
            }
        },
        bullet_list: {
            check: (editor: Editor) => isNodeInSchema("bulletList", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleBulletList().run();
            }
        },
        ordered_list: {
            check: (editor: Editor) => isNodeInSchema("orderedList", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleOrderedList().run();
            }
        },
        task_list: {
            check: (editor: Editor) => isNodeInSchema("taskList", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleTaskList().run();
            }
        },
        quote: {
            check: (editor: Editor) => isNodeInSchema("blockquote", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleBlockquote().run();
            }
        },
        code_block: {
            check: (editor: Editor) => isNodeInSchema("codeBlock", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().toggleNode("codeBlock", "paragraph").run();
            }
        },

        // Insert
        mention: {
            check: (editor: Editor) => isExtensionAvailable(editor, ["mention", "mentionAdvanced"]),
            action: ({ editor }: { editor: Editor }) => addMentionTrigger(editor)
        },
        emoji: {
            check: (editor: Editor) => isExtensionAvailable(editor, ["emoji", "emojiPicker"]),
            action: ({ editor }: { editor: Editor }) => addEmojiTrigger(editor)
        },
        divider: {
            check: (editor: Editor) => isNodeInSchema("horizontalRule", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor.chain().focus().setHorizontalRule().run();
            }
        },

        // Upload
        image: {
            check: (editor: Editor) => isNodeInSchema("image", editor),
            action: ({ editor }: { editor: Editor }) => {
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: "imageUpload"
                    })
                    .run();
            }
        }
    };
};

function organizeItemsByGroups(items: SuggestionItem[], showGroups: boolean): SuggestionItem[] {
    if (!showGroups) {
        return items.map((item) => ({ ...item, group: "" }));
    }

    const groups: Record<string, SuggestionItem[]> = {};

    // Group items
    items.forEach((item) => {
        const groupLabel = item.group || "";
        if (!groups[groupLabel]) {
            groups[groupLabel] = [];
        }
        groups[groupLabel].push(item);
    });

    // Flatten groups in order (this maintains the visual order for keyboard navigation)
    const organizedItems: SuggestionItem[] = [];
    Object.entries(groups).forEach(([, groupItems]) => {
        organizedItems.push(...groupItems);
    });

    return organizedItems;
}

/**
 * Custom hook for slash dropdown menu functionality
 */
export function useSlashDropdownMenu(config?: SlashMenuConfig) {
    const getSlashMenuItems = React.useCallback(
        (editor: Editor) => {
            const items: SuggestionItem[] = [];

            const enabledItems = config?.enabledItems || (Object.keys(texts) as SlashMenuItemType[]);
            const showGroups = config?.showGroups !== false;

            const itemImplementations = getItemImplementations();
            enabledItems.forEach((itemType) => {
                const itemImpl = itemImplementations[itemType];
                const itemText = texts[itemType];

                if (itemImpl && itemText && itemImpl.check(editor)) {
                    const item: SuggestionItem = {
                        onSelect: ({ editor }) => itemImpl.action({ editor }),
                        ...itemText
                    };

                    if (config?.itemGroups?.[itemType]) {
                        item.group = config.itemGroups[itemType];
                    } else if (!showGroups) {
                        item.group = "";
                    }

                    items.push(item);
                }
            });

            if (config?.customItems) {
                items.push(...config.customItems);
            }

            // Reorganize items by groups to ensure keyboard navigation works correctly
            return organizeItemsByGroups(items, showGroups);
        },
        [config]
    );

    return {
        getSlashMenuItems,
        config
    };
}
