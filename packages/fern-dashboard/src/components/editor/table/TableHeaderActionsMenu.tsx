import type { NodeViewProps } from "@tiptap/core";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";

import EllipsisButton from "../editor-component/EllipsisButton";

export default function TableHeaderActionsMenu(props: NodeViewProps) {
    const disabled = useEditingDisabled();
    const { getPos, editor } = props;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <EllipsisButton orientation="horizontal" className="w-fit bg-gray-400 px-1 py-0 hover:bg-gray-400" />
            </PopoverTrigger>
            <PopoverContent className="table-popover flex min-w-[200px] flex-col p-0">
                <p className="p-3 pb-1.5 editor-component-title">Column</p>
                <div className="border-border-default border-t" />
                <div className="flex flex-col gap-px p-1">
                    <Button
                        variant="ghost"
                        onClick={() => {
                            const pos = getPos();
                            if (pos !== undefined) {
                                editor.chain().focus().setTextSelection(pos).addColumnBefore().run();
                            }
                        }}
                        disabled={disabled}
                        className="justify-start"
                    >
                        <ArrowLeft className="size-4" />
                        Insert Column Before
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            const pos = getPos();
                            if (pos !== undefined) {
                                editor.chain().focus().setTextSelection(pos).addColumnAfter().run();
                            }
                        }}
                        disabled={disabled}
                        className="justify-start"
                    >
                        <ArrowRight className="size-4" />
                        Insert Column After
                    </Button>
                    <hr className="border-border-default -mx-1 my-1" />
                    <Button
                        variant="ghost"
                        onClick={() => {
                            const pos = getPos();
                            if (pos !== undefined) {
                                editor.chain().focus().setTextSelection(pos).deleteColumn().run();
                            }
                        }}
                        disabled={disabled}
                        className="justify-start hover:text-red-600"
                    >
                        <Trash2 className="size-4" />
                        Delete Column
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
