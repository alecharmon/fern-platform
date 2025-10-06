import { useState } from "react";

import * as Popover from "@radix-ui/react-popover";
import { useCurrentEditor } from "@tiptap/react";
import { BubbleMenu as EditorBubbleMenu } from "@tiptap/react/menus";
import type { MouseEventHandler } from "react";

import { Icon } from "@/components/icon/Icon";
import { cn } from "@/utils/utils";

import { LinkPopover } from "./LinkPopover";

type TextBubbleMenuAction =
    | "setNodeType"
    | "toggleBold"
    | "toggleItalic"
    | "toggleUnderline"
    | "toggleStrike"
    | "toggleCode"
    | "toggleBulletList"
    | "toggleOrderedList";

export default function TextBubbleMenu() {
    const { editor } = useCurrentEditor();
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);

    function menuItemClickHandler(action: TextBubbleMenuAction) {
        return () => {
            if (!editor) return;

            switch (action) {
                case "setNodeType":
                    // TODO: This should open an additional popover to select the heading level
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                    break;
                case "toggleBold":
                    editor.chain().focus().toggleBold().run();
                    break;
                case "toggleItalic":
                    editor.chain().focus().toggleItalic().run();
                    break;
                case "toggleUnderline":
                    editor.chain().focus().toggleUnderline().run();
                    break;
                case "toggleStrike":
                    editor.chain().focus().toggleStrike().run();
                    break;
                case "toggleCode":
                    editor.chain().focus().toggleCode().run();
                    break;
                case "toggleBulletList":
                    editor.chain().focus().toggleBulletList().run();
                    break;
                case "toggleOrderedList":
                    editor.chain().focus().toggleOrderedList().run();
                    break;
            }
        };
    }

    if (!editor) {
        return null;
    }

    return (
        <EditorBubbleMenu
            options={{ placement: "top-start" }}
            shouldShow={({ editor, state: { selection } }) => {
                // Don't show the bubble menu if the selection is an image or image upload
                if (
                    editor.isActive("custom-element-v2") ||
                    editor.isActive("mediaUpload") ||
                    editor.isActive("table")
                ) {
                    return false;
                }

                // Check if we have an active selection
                return editor.isFocused && !selection.empty;
            }}
        >
            <div className="border-1 rounded-2 text-gray-1100 flex items-center gap-px border-gray-500 bg-white p-1 shadow-sm">
                <BubbleMenuItem iconProps={{ variant: "Heading1" }} onClick={menuItemClickHandler("setNodeType")} />
                <BubbleMenuSeparator />
                <BubbleMenuItem iconProps={{ variant: "Bold" }} onClick={menuItemClickHandler("toggleBold")} />
                <BubbleMenuItem iconProps={{ variant: "Italic" }} onClick={menuItemClickHandler("toggleItalic")} />
                <BubbleMenuItem
                    iconProps={{ variant: "Underline" }}
                    onClick={menuItemClickHandler("toggleUnderline")}
                />
                <Popover.Root open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
                    <Popover.Trigger asChild>
                        <button
                            className="rounded-1 cursor-pointer p-1 transition-colors hover:bg-gray-300 hover:transition-none"
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            <div className="flex size-6 items-center justify-center">
                                <Icon variant="Link" size={20} />
                            </div>
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content
                            className={cn(
                                "bg-popover text-popover-foreground border-border-default z-50 w-80 rounded-lg border p-0 shadow-md",
                                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                                "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                                "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                                "data-[side=bottom]:slide-in-from-top-2",
                                "data-[side=left]:slide-in-from-right-2",
                                "data-[side=right]:slide-in-from-left-2",
                                "data-[side=top]:slide-in-from-bottom-2"
                            )}
                            sideOffset={5}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                            <LinkPopover editor={editor} onClose={() => setLinkPopoverOpen(false)} />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
                <BubbleMenuItem iconProps={{ variant: "Code" }} onClick={menuItemClickHandler("toggleCode")} />
                <BubbleMenuSeparator />
                <BubbleMenuItem iconProps={{ variant: "List" }} onClick={menuItemClickHandler("toggleBulletList")} />
                <BubbleMenuItem
                    iconProps={{ variant: "ListOrdered" }}
                    onClick={menuItemClickHandler("toggleOrderedList")}
                />
            </div>
        </EditorBubbleMenu>
    );
}

declare namespace BubbleMenuItem {
    export interface Props {
        iconProps: Icon.Props;
        onClick?: MouseEventHandler<HTMLButtonElement>;
    }
}

function BubbleMenuItem({ iconProps, onClick }: BubbleMenuItem.Props) {
    const { size = 20, ...restIconProps } = iconProps;

    return (
        <button
            className="rounded-1 cursor-pointer p-1 transition-colors hover:bg-gray-300 hover:transition-none"
            onClick={onClick}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div className="flex size-6 items-center justify-center">
                <Icon size={size} {...restIconProps} />
            </div>
        </button>
    );
}

function BubbleMenuSeparator() {
    return (
        <div className="flex h-6 w-1.5 items-center justify-center">
            <div className="h-5 w-px bg-gray-300" />
        </div>
    );
}
