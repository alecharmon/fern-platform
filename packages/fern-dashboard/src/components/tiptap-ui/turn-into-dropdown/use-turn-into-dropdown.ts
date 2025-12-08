"use client";

import type { Editor } from "@tiptap/react";
import { Heading1, Heading2, Heading3, List, ListCheck, ListOrdered, QuoteIcon, Type } from "lucide-react";
import * as React from "react";

import { isNodeInSchema } from "@/utils/tiptap-utils";

export interface TurnIntoItem {
    title: string;
    badge?: React.ComponentType<{ className?: string }>;
    action: (editor: Editor, pos?: number) => void;
    check: (editor: Editor) => boolean;
    isActive?: (editor: Editor, pos?: number) => boolean;
}

const getTurnIntoItems = (): TurnIntoItem[] => {
    return [
        {
            title: "Text",
            badge: Type,
            check: (editor: Editor) => isNodeInSchema("paragraph", editor),
            isActive: (editor: Editor) => editor.isActive("paragraph"),
            action: (editor: Editor) => {
                editor.chain().focus().setParagraph().run();
            }
        },
        {
            title: "Heading 1",
            badge: Heading1,
            check: (editor: Editor) => isNodeInSchema("heading", editor),
            isActive: (editor: Editor) => editor.isActive("heading", { level: 1 }),
            action: (editor: Editor) => {
                editor.chain().focus().setHeading({ level: 1 }).run();
            }
        },
        {
            title: "Heading 2",
            badge: Heading2,
            check: (editor: Editor) => isNodeInSchema("heading", editor),
            isActive: (editor: Editor) => editor.isActive("heading", { level: 2 }),
            action: (editor: Editor) => {
                editor.chain().focus().setHeading({ level: 2 }).run();
            }
        },
        {
            title: "Heading 3",
            badge: Heading3,
            check: (editor: Editor) => isNodeInSchema("heading", editor),
            isActive: (editor: Editor) => editor.isActive("heading", { level: 3 }),
            action: (editor: Editor) => {
                editor.chain().focus().setHeading({ level: 3 }).run();
            }
        },
        {
            title: "Bullet List",
            badge: List,
            check: (editor: Editor) => isNodeInSchema("bulletList", editor),
            isActive: (editor: Editor) => editor.isActive("bulletList"),
            action: (editor: Editor) => {
                editor.chain().focus().toggleBulletList().run();
            }
        },
        {
            title: "Numbered List",
            badge: ListOrdered,
            check: (editor: Editor) => isNodeInSchema("orderedList", editor),
            isActive: (editor: Editor) => editor.isActive("orderedList"),
            action: (editor: Editor) => {
                editor.chain().focus().toggleOrderedList().run();
            }
        },
        {
            title: "To-do List",
            badge: ListCheck,
            check: (editor: Editor) => isNodeInSchema("taskList", editor),
            isActive: (editor: Editor) => editor.isActive("taskList"),
            action: (editor: Editor) => {
                editor.chain().focus().toggleTaskList().run();
            }
        },
        {
            title: "Blockquote",
            badge: QuoteIcon,
            check: (editor: Editor) => isNodeInSchema("blockquote", editor),
            isActive: (editor: Editor) => editor.isActive("blockquote"),
            action: (editor: Editor) => {
                editor.chain().focus().toggleBlockquote().run();
            }
        }
    ];
};

export function useTurnIntoDropdown() {
    const getTurnIntoMenuItems = React.useCallback((editor: Editor) => {
        const items = getTurnIntoItems();
        return items.filter((item) => item.check(editor));
    }, []);

    return {
        getTurnIntoMenuItems
    };
}
