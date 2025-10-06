import { type NodeViewProps, useCurrentEditor } from "@tiptap/react";
import { ArrowDown, ArrowRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";

import EllipsisButton from "./editor-component/EllipsisButton";

export default function TableActionsMenu({
    handleAdd,
    deleteNode
}: {
    handleAdd: (type: "row" | "col") => void;
    deleteNode: NodeViewProps["deleteNode"];
}) {
    const { editor } = useCurrentEditor();
    const disabled = useEditingDisabled();

    if (!editor || disabled) {
        return null;
    }

    return (
        <div className="-right-15 absolute top-1 z-10">
            <Popover>
                <PopoverTrigger asChild>
                    <EllipsisButton />
                </PopoverTrigger>
                <PopoverContent className="flex min-w-[200px] flex-col p-1">
                    <p className="p-1 px-2 text-xs font-medium uppercase tracking-wide text-gray-900">Table</p>
                    <Button
                        variant="ghost"
                        onClick={() => handleAdd("row")}
                        disabled={disabled}
                        className="justify-start"
                    >
                        <ArrowDown className="size-4" />
                        Add Row
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => handleAdd("col")}
                        disabled={disabled}
                        className="justify-start"
                    >
                        <ArrowRight className="size-4" />
                        Add Column
                    </Button>
                    <hr className="border-border-default my-1" />
                    <Button variant="ghost" onClick={() => deleteNode()} className="justify-start hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                        Delete Table
                    </Button>
                </PopoverContent>
            </Popover>
        </div>
    );
}
