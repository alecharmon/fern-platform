import { PopoverPortal } from "@radix-ui/react-popover";
import { useCurrentEditor } from "@tiptap/react";
import { BubbleMenu as EditorBubbleMenu } from "@tiptap/react/menus";
import type { MouseEventHandler } from "react";
import { useEffect, useMemo, useState } from "react";
import type { IconName } from "@/components/icon/Icon";
import { Icon } from "@/components/icon/Icon";
import { Button, ButtonGroup } from "@/components/tiptap-ui-primitive/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { LinkPopover } from "./LinkPopover";

type TextBubbleMenuAction =
    | "toggleBold"
    | "toggleItalic"
    | "toggleUnderline"
    | "toggleStrike"
    | "toggleCode"
    | "toggleBulletList"
    | "toggleOrderedList";

type NodeType = "paragraph" | "heading1" | "heading2" | "heading3" | "heading4";

const NODE_TYPE_CONFIG: Record<NodeType, { icon: IconName; label: string }> = {
    paragraph: { icon: "Type", label: "Text" },
    heading1: { icon: "Heading1", label: "Heading 1" },
    heading2: { icon: "Heading2", label: "Heading 2" },
    heading3: { icon: "Heading3", label: "Heading 3" },
    heading4: { icon: "Heading4", label: "Heading 4" }
};

export declare namespace TextBubbleMenu {
    export interface Props {
        disableNodeTypeSwitching?: boolean;
    }
}

export default function TextBubbleMenu({ disableNodeTypeSwitching = false }: TextBubbleMenu.Props = {}) {
    const { editor } = useCurrentEditor();
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
    const [headingDropdownOpen, setHeadingDropdownOpen] = useState(false);

    // Close the link popover when the component unmounts
    useEffect(() => {
        return () => {
            setLinkPopoverOpen(false);
        };
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when editor.state.selection changes
    const currentNodeType = useMemo((): NodeType => {
        if (!editor) {
            return "paragraph";
        }
        if (editor.isActive("heading", { level: 1 })) {
            return "heading1";
        }
        if (editor.isActive("heading", { level: 2 })) {
            return "heading2";
        }
        if (editor.isActive("heading", { level: 3 })) {
            return "heading3";
        }
        if (editor.isActive("heading", { level: 4 })) {
            return "heading4";
        }
        return "paragraph";
    }, [editor?.state.selection]);

    function setNodeType(nodeType: NodeType) {
        if (!editor) {
            return;
        }

        if (nodeType === "paragraph") {
            editor.chain().focus().setParagraph().run();
        } else {
            const level = parseInt(nodeType.replace("heading", "")) as 1 | 2 | 3 | 4;
            editor.chain().focus().setHeading({ level }).run();
        }
        setHeadingDropdownOpen(false);
    }

    function menuItemClickHandler(action: TextBubbleMenuAction) {
        return () => {
            if (!editor) {
                return;
            }

            switch (action) {
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

    const currentConfig = NODE_TYPE_CONFIG[currentNodeType];

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

                // Don't show the bubble menu for inline custom elements (e.g., unsupported inline tags)
                if (editor.isActive("custom-inline-element-v2")) {
                    return false;
                }

                // Don't show the bubble menu for inline math nodes
                if (editor.isActive("inlineMath") || editor.isActive("mathInline")) {
                    return false;
                }

                // Check if we have an active selection
                return editor.isFocused && !selection.empty;
            }}
        >
            <div className="border-1 rounded-3 text-gray-1100 flex items-center gap-px border-gray-500 bg-white p-0.5 shadow-sm">
                {!disableNodeTypeSwitching && (
                    <>
                        <Popover open={headingDropdownOpen} onOpenChange={setHeadingDropdownOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    className="rounded-2 flex cursor-pointer items-center gap-1 p-1 transition-colors hover:bg-gray-300 hover:transition-none"
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <div className="flex size-6 items-center justify-center">
                                        <Icon variant={currentConfig.icon} size={16} />
                                    </div>
                                    <Icon variant="ChevronDown" size={12} />
                                </button>
                            </PopoverTrigger>
                            <PopoverPortal>
                                <PopoverContent
                                    className="w-48 p-1"
                                    side="bottom"
                                    sideOffset={8}
                                    onOpenAutoFocus={(e) => e.preventDefault()}
                                    onCloseAutoFocus={(e) => e.preventDefault()}
                                >
                                    <ButtonGroup className="gap-px">
                                        {(Object.keys(NODE_TYPE_CONFIG) as NodeType[]).map((nodeType) => {
                                            const config = NODE_TYPE_CONFIG[nodeType];
                                            const isActive = currentNodeType === nodeType;

                                            return (
                                                <Button
                                                    key={nodeType}
                                                    className="cursor-pointer"
                                                    data-style="ghost"
                                                    data-active-state={isActive ? "on" : "off"}
                                                    onClick={() => setNodeType(nodeType)}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                >
                                                    <Icon
                                                        variant={config.icon}
                                                        className="tiptap-button-icon"
                                                        size={16}
                                                    />
                                                    <div className="tiptap-button-text">{config.label}</div>
                                                </Button>
                                            );
                                        })}
                                    </ButtonGroup>
                                </PopoverContent>
                            </PopoverPortal>
                        </Popover>
                        <BubbleMenuSeparator />
                    </>
                )}
                <BubbleMenuItem iconProps={{ variant: "Bold" }} onClick={menuItemClickHandler("toggleBold")} />
                <BubbleMenuItem iconProps={{ variant: "Italic" }} onClick={menuItemClickHandler("toggleItalic")} />
                <BubbleMenuItem
                    iconProps={{ variant: "Underline" }}
                    onClick={menuItemClickHandler("toggleUnderline")}
                />
                <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="rounded-2 cursor-pointer p-1 transition-colors hover:bg-gray-300 hover:transition-none"
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            <div className="flex size-6 items-center justify-center">
                                <Icon variant="Link" size={16} />
                            </div>
                        </button>
                    </PopoverTrigger>
                    <PopoverPortal>
                        <PopoverContent
                            className="p-0"
                            side="bottom"
                            sideOffset={8}
                            onOpenAutoFocus={(e) => e.preventDefault()}
                            onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                            <LinkPopover editor={editor} onClose={() => setLinkPopoverOpen(false)} />
                        </PopoverContent>
                    </PopoverPortal>
                </Popover>
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
    const { size = 16, ...restIconProps } = iconProps;

    return (
        <button
            className="rounded-2 cursor-pointer p-1 transition-colors hover:bg-gray-300 hover:transition-none"
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
