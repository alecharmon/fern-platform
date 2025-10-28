import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useCurrentEditor } from "@tiptap/react";
import { GripVertical } from "lucide-react";

export default function NodeHoverHandle() {
    const { editor } = useCurrentEditor();

    if (!editor) return null;

    // Retrieve the editor ID to tag drag events with their origin editor
    const editorIdFromAttrs = (editor.options.editorProps as any)?.attributes?.["data-editor-id"];
    const editorIdFromDom = (editor?.view?.dom as HTMLElement)?.getAttribute?.("data-editor-id") ?? undefined;
    const editorId = editorIdFromAttrs || editorIdFromDom || "";

    return (
        <DragHandle
            editor={editor}
            computePositionConfig={{ placement: "left-start", strategy: "absolute" }}
            onNodeChange={({ node }) => {
                (window as any).__currentHoverNode__ = node?.toJSON();
            }}
        >
            <div className="pr-2">
                <div
                    draggable
                    // Stamp the origin editor's ID onto the drag event for cross-editor detection
                    onDragStart={(event) => {
                        try {
                            event.dataTransfer?.setData("editor-id", editorId);
                            event.dataTransfer?.setData("application/x-tiptap-dnd", "1");
                        } catch {}
                    }}
                    className="fern-hover-handle flex flex-col items-center rounded-md p-1.5 hover:bg-gray-500/40 cursor-grab"
                >
                    <GripVertical className="text-muted-foreground" size={16} />
                </div>
            </div>
        </DragHandle>
    );
}
