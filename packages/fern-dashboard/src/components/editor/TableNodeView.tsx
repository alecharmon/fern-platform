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
        // Use requestAnimationFrame to ensure the editor state is fully synchronized
        // This fixes an issue where getPos() or editor.state might be stale immediately
        // after table insertion or on pages that haven't had recent edits
        requestAnimationFrame(() => {
            const pos = getPos();
            if (typeof pos !== "number") {
                return;
            }
            // Use editor.view.state.doc to ensure we have the most current document state
            const table = editor.view.state.doc.nodeAt(pos);
            if (!table || table.type.name !== "table") {
                return;
            }
            // Find a valid text position inside a cell's paragraph
            // TextSelection requires a position inside a node with inline content (paragraph)
            // Table structure: table > tableRow > tableCell/tableHeader > paragraph
            let targetCellPos: number | null = null;
            let rowCount = 0;
            let currentRowCellPos: number | null = null;
            let lastCellInFirstRow: number | null = null;
            let insideCell = false;

            table.descendants((node, nodePos) => {
                if (node.type.name === "tableRow") {
                    rowCount++;
                    if (rowCount > 1 && type === "col") {
                        return false;
                    }
                    currentRowCellPos = null;
                    insideCell = false;
                }
                if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
                    insideCell = true;
                }
                // Find the paragraph inside the cell - this is where we can place a TextSelection
                if (insideCell && node.type.name === "paragraph") {
                    // pos + nodePos gives us the paragraph position, +1 to get inside it
                    currentRowCellPos = pos + nodePos + 1;
                    if (rowCount === 1) {
                        lastCellInFirstRow = currentRowCellPos;
                    }
                    insideCell = false;
                }
                return true;
            });

            if (type === "row") {
                targetCellPos = currentRowCellPos;
            } else {
                targetCellPos = lastCellInFirstRow;
            }

            if (targetCellPos !== null) {
                if (type === "row") {
                    editor.chain().focus().setTextSelection(targetCellPos).addRowAfter().run();
                } else {
                    editor.chain().focus().setTextSelection(targetCellPos).addColumnAfter().run();
                }
            }
        });
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
