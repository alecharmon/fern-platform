import { Button } from "@fern-docs/components/button";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { PlusCircle } from "lucide-react";

import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { cn } from "@/utils/utils";

import TableActionsMenu from "./TableActionsMenu";

export default function TableNodeView({ editor, deleteNode, getPos }: NodeViewProps) {
    const disabled = useEditingDisabled();

    const handleAdd = (type: "row" | "col") => {
        if (disabled) {
            return;
        }
        const pos = getPos();
        if (typeof pos === "number") {
            const table = editor.state.doc.nodeAt(pos);
            if (table) {
                const lastRowPos = pos + table.nodeSize - 2; // Position before closing tag
                if (type === "row") {
                    editor.chain().focus(lastRowPos).addRowAfter().run();
                } else {
                    editor.chain().focus(lastRowPos).addColumnAfter().run();
                }
            }
        }
    };

    return (
        <NodeViewWrapper className="table-node my-1 -mr-[25px] -mt-3 overflow-x-visible pt-2">
            <div className="flex w-full flex-col gap-1">
                <div className="flex gap-1">
                    <div className="relative w-full overflow-visible">
                        <TableActionsMenu handleAdd={handleAdd} deleteNode={deleteNode} />
                        <div className={cn("fern-table-root fern-table mb-0 mt-0 flex-1 overflow-visible")}>
                            <NodeViewContent />
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="xs"
                        className="border-border-default h-auto cursor-pointer border border-dashed !px-0.5"
                        onClick={() => handleAdd("col")}
                        disabled={disabled}
                    >
                        <PlusCircle className="size-4" />
                    </Button>
                </div>
                <Button
                    variant="ghost"
                    size="xs"
                    className="border-border-default w-[calc(100%-26px)] cursor-pointer border border-dashed"
                    onClick={() => handleAdd("row")}
                    disabled={disabled}
                >
                    <PlusCircle className="size-4" />
                </Button>
            </div>
        </NodeViewWrapper>
    );
}
