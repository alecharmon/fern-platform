import type { NodeViewProps } from "@tiptap/core";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";

import EllipsisButton from "../editor-component/EllipsisButton";

export default function TableRowActionsMenu(props: NodeViewProps) {
    const { editor, getPos, deleteNode: deleteRow } = props;
    const disabled = useEditingDisabled();

    const isHeaderRow = useMemo(() => {
        const pos = getPos();
        if (pos === undefined) {
            return true;
        }
        const resolvedPos = editor.state.doc.resolve(pos);

        const index = resolvedPos.index(resolvedPos.depth);
        return index === 0;
    }, [editor, getPos]);

    const handleAddRowBefore = useCallback(() => {
        const pos = getPos();
        if (pos !== undefined) {
            const cellPos = pos + 2; // Add 2 so that we are inside the first cell
            editor.chain().focus().setTextSelection(cellPos).addRowBefore().run();
        }
    }, [editor, getPos]);

    const handleAddRowAfter = useCallback(() => {
        const pos = getPos();
        if (pos !== undefined) {
            const cellPos = pos + 2; // Add 2 so that we are inside the first cell
            editor.chain().focus().setTextSelection(cellPos).addRowAfter().run();
        }
    }, [editor, getPos]);

    const handleDeleteRow = useCallback(() => {
        deleteRow();
    }, [deleteRow]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <EllipsisButton className="bg-gray-400 px-0 py-1 hover:bg-gray-400" disabled={disabled} />
            </PopoverTrigger>
            <PopoverContent className="flex min-w-[200px] flex-col p-0">
                <p className="p-3 pb-1.5 editor-component-title">Row</p>
                <div className="border-border-default border-t" />
                <div className="flex flex-col gap-px p-1">
                    {!isHeaderRow && (
                        <Button variant="ghost" onClick={handleAddRowBefore} className="justify-start">
                            <ArrowUp className="size-4" />
                            Insert Row Above
                        </Button>
                    )}
                    <Button variant="ghost" onClick={handleAddRowAfter} className="justify-start">
                        <ArrowDown className="size-4" />
                        Insert Row Below
                    </Button>

                    {!isHeaderRow && (
                        <>
                            <hr className="border-border-default -mx-1 my-1" />
                            <Button
                                variant="ghost"
                                onClick={handleDeleteRow}
                                disabled={disabled}
                                className="justify-start hover:text-red-600"
                            >
                                <Trash2 className="size-4" />
                                Delete Row
                            </Button>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
