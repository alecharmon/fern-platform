import type { NodeViewProps } from "@tiptap/core";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";

import EllipsisButton from "../editor-component/EllipsisButton";

export default function TableRowActionsMenu(props: NodeViewProps) {
    const { editor, getPos, deleteNode: deleteRow } = props;
    const disabled = useEditingDisabled();

    const isHeaderRow = useMemo(() => {
        const pos = getPos();
        if (pos === undefined) return true;
        const resolvedPos = editor.state.doc.resolve(pos);

        const index = resolvedPos.index(resolvedPos.depth);
        return index === 0;
    }, [editor, getPos]);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <EllipsisButton className="bg-gray-400 px-0 py-1 hover:bg-gray-400" disabled={disabled} />
            </PopoverTrigger>
            <PopoverContent className="flex min-w-[200px] flex-col p-1">
                <p className="p-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-900">Row</p>
                {!isHeaderRow && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            const pos = getPos();
                            if (pos !== undefined) {
                                const cellPos = pos + 2; // Add 2 so that we are inside the first cell
                                editor.chain().focus().setTextSelection(cellPos).addRowBefore().run();
                            }
                        }}
                        className="justify-start"
                    >
                        <ArrowUp className="size-4" />
                        Insert Row Above
                    </Button>
                )}
                <Button
                    variant="ghost"
                    onClick={() => {
                        const pos = getPos();
                        if (pos !== undefined) {
                            const cellPos = pos + 2; // Add 2 so that we are inside the first cell
                            editor.chain().focus().setTextSelection(cellPos).addRowAfter().run();
                        }
                    }}
                    className="justify-start"
                >
                    <ArrowDown className="size-4" />
                    Insert Row Below
                </Button>

                {!isHeaderRow && (
                    <>
                        <hr className="border-border-default my-1" />
                        <Button
                            variant="ghost"
                            onClick={() => deleteRow()}
                            disabled={disabled}
                            className="justify-start hover:text-red-600"
                        >
                            <Trash2 className="size-4" />
                            Delete Row
                        </Button>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
