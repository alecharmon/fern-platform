import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useCurrentEditor } from "@tiptap/react";
import { ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TurnIntoMenu } from "@/components/tiptap-ui/turn-into-dropdown/TurnIntoMenu";
import { useTurnIntoDropdown } from "@/components/tiptap-ui/turn-into-dropdown/use-turn-into-dropdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function NodeHoverHandle() {
    const { editor } = useCurrentEditor();
    const { getTurnIntoMenuItems } = useTurnIntoDropdown();
    const currentNodePosRef = useRef<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isTurnIntoOpen, setIsTurnIntoOpen] = useState(false);
    const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const closeTimerRef = useRef<number | null>(null);

    const cancelScheduledClose = useCallback(() => {
        if (closeTimerRef.current != null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    const scheduleClose = useCallback(() => {
        if (closeTimerRef.current != null) {
            window.clearTimeout(closeTimerRef.current);
        }
        closeTimerRef.current = window.setTimeout(() => {
            setIsPopoverOpen(false);
            setIsTurnIntoOpen(false);
            closeTimerRef.current = null;
        }, 1000);
    }, []);

    useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

    if (!editor) {
        return null;
    }

    // Retrieve the editor ID to tag drag events with their origin editor
    const editorIdFromAttrs = (editor.options.editorProps as any)?.attributes?.["data-editor-id"];
    const editorIdFromDom = (editor?.view?.dom as HTMLElement)?.getAttribute?.("data-editor-id") ?? undefined;
    const editorId = editorIdFromAttrs || editorIdFromDom || "";

    const handleInsertBlockBelow = () => {
        if (currentNodePosRef.current === null || !editor) {
            return;
        }

        const pos = currentNodePosRef.current;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) {
            return;
        }

        const insertPos = pos + node.nodeSize;

        editor
            .chain()
            .focus()
            .insertContentAt(insertPos, { type: "paragraph" })
            .setTextSelection(insertPos + 1)
            .run();
    };

    const handleSelectBlock = () => {
        if (currentNodePosRef.current === null || !editor) {
            return;
        }

        const pos = currentNodePosRef.current;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) {
            return;
        }

        editor.commands.setNodeSelection(pos);
    };

    const handleDeleteBlock = () => {
        if (currentNodePosRef.current === null || !editor) {
            return;
        }

        const pos = currentNodePosRef.current;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) {
            return;
        }

        const from = pos;
        const to = pos + node.nodeSize;

        editor.chain().focus().deleteRange({ from, to }).run();
        setIsPopoverOpen(false);
    };

    const handleMouseDown = (event: React.MouseEvent) => {
        dragStartPosRef.current = { x: event.clientX, y: event.clientY };
        setIsDragging(false);
    };

    const handleDragStart = (event: React.DragEvent) => {
        setIsDragging(true);
        try {
            (window as any).__fernDraggingEditorId = editorId;
            event.dataTransfer?.setData("editor-id", editorId);
            event.dataTransfer?.setData("application/x-tiptap-dnd", "1");
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = "move";
            }
        } catch {}
    };

    const handleDragEnd = () => {
        (window as any).__fernDraggingEditorId = undefined;
        document.body.classList.remove("fern-dragging-blocked");
        setIsDragging(false);
        dragStartPosRef.current = null;
    };

    const handleClick = (event: React.MouseEvent) => {
        if (isDragging) {
            return;
        }

        const startPos = dragStartPosRef.current;
        if (startPos) {
            const distance = Math.sqrt(
                Math.pow(event.clientX - startPos.x, 2) + Math.pow(event.clientY - startPos.y, 2)
            );
            if (distance > 5) {
                return;
            }
        }

        handleSelectBlock();
        setIsPopoverOpen(true);
    };

    return (
        <DragHandle
            editor={editor}
            className="tiptap-node-hover-handle"
            computePositionConfig={{ placement: "left-start", strategy: "absolute" }}
            onNodeChange={({ node, pos }) => {
                (window as any).__currentHoverNode__ = node?.toJSON();
                currentNodePosRef.current = pos;
                if (isPopoverOpen) {
                    cancelScheduledClose();
                    setIsPopoverOpen(false);
                }
            }}
        >
            <div className="pr-2 flex items-center gap-px translate-y-0.5">
                <button
                    type="button"
                    onClick={handleInsertBlockBelow}
                    draggable={false}
                    className="fern-hover-handle flex items-center justify-center rounded-md py-1 px-0.5 hover:bg-gray-500/40 cursor-pointer leading-none"
                    aria-label="Insert block below"
                >
                    <Plus className="text-muted-foreground" size={16} />
                </button>
                <Popover
                    modal={false}
                    open={isPopoverOpen}
                    onOpenChange={(open) => {
                        setIsPopoverOpen(open);
                        if (open) {
                            cancelScheduledClose();
                        } else {
                            setIsTurnIntoOpen(false);
                        }
                    }}
                >
                    <PopoverTrigger asChild>
                        <div
                            draggable
                            onMouseDown={handleMouseDown}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                                handleClick(e);
                                cancelScheduledClose();
                            }}
                            className="fern-hover-handle flex items-center justify-center rounded-md py-1 px-0.5 hover:bg-gray-500/40 cursor-grab active:cursor-grabbing leading-none"
                        >
                            <GripVertical className="text-muted-foreground" size={16} />
                        </div>
                    </PopoverTrigger>
                    <PopoverContent
                        className="flex min-w-[200px] flex-col p-0"
                        onMouseLeave={scheduleClose}
                        onMouseEnter={cancelScheduledClose}
                        onPointerDownOutside={() => {
                            cancelScheduledClose();
                            setIsPopoverOpen(false);
                            setIsTurnIntoOpen(false);
                        }}
                    >
                        <p className="p-3 pb-1.5 editor-component-title">Block</p>
                        <div className="border-border-default border-t" />
                        <div className="flex flex-col gap-px p-1">
                            <Popover modal={false} open={isTurnIntoOpen} onOpenChange={setIsTurnIntoOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="justify-between"
                                        onMouseEnter={() => {
                                            setIsTurnIntoOpen(true);
                                            cancelScheduledClose();
                                        }}
                                        onMouseLeave={scheduleClose}
                                    >
                                        <span>Turn into</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    side="right"
                                    align="start"
                                    sideOffset={-4}
                                    className="flex min-w-[200px] flex-col p-0"
                                    onMouseEnter={cancelScheduledClose}
                                    onMouseLeave={scheduleClose}
                                >
                                    {editor && (
                                        <TurnIntoMenu
                                            editor={editor}
                                            items={getTurnIntoMenuItems(editor)}
                                            onSelect={(item) => {
                                                item.action(editor);
                                                setIsPopoverOpen(false);
                                                setIsTurnIntoOpen(false);
                                            }}
                                        />
                                    )}
                                </PopoverContent>
                            </Popover>
                            <Button
                                variant="ghost"
                                onClick={handleDeleteBlock}
                                className="justify-start hover:text-red-600"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Block
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </DragHandle>
    );
}
