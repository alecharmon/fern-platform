import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useCurrentEditor } from "@tiptap/react";
import { GripVertical, Plus } from "lucide-react";
import { useRef } from "react";

export default function NodeHoverHandle() {
    const { editor } = useCurrentEditor();
    const currentNodePosRef = useRef<number | null>(null);

    if (!editor) return null;

    // Retrieve the editor ID to tag drag events with their origin editor
    const editorIdFromAttrs = (editor.options.editorProps as any)?.attributes?.["data-editor-id"];
    const editorIdFromDom = (editor?.view?.dom as HTMLElement)?.getAttribute?.("data-editor-id") ?? undefined;
    const editorId = editorIdFromAttrs || editorIdFromDom || "";

    const handleInsertBlockBelow = () => {
        if (currentNodePosRef.current === null || !editor) return;

        const pos = currentNodePosRef.current;
        const node = editor.state.doc.nodeAt(pos);
        if (!node) return;

        const insertPos = pos + node.nodeSize;

        editor
            .chain()
            .focus()
            .insertContentAt(insertPos, { type: "paragraph" })
            .setTextSelection(insertPos + 1)
            .run();
    };

    return (
        <DragHandle
            editor={editor}
            computePositionConfig={{ placement: "left-start", strategy: "absolute" }}
            onNodeChange={({ node, pos }) => {
                (window as any).__currentHoverNode__ = node?.toJSON();
                currentNodePosRef.current = pos;
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
                <div
                    draggable
                    onDragStart={(event) => {
                        try {
                            event.dataTransfer?.setData("editor-id", editorId);
                            event.dataTransfer?.setData("application/x-tiptap-dnd", "1");
                        } catch {}
                    }}
                    className="fern-hover-handle flex items-center justify-center rounded-md py-1 px-0.5 hover:bg-gray-500/40 cursor-grab leading-none"
                >
                    <GripVertical className="text-muted-foreground" size={16} />
                </div>
            </div>
        </DragHandle>
    );
}
