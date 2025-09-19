import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { useCurrentEditor } from "@tiptap/react";
import { GripVertical } from "lucide-react";

export default function NodeHoverHandle() {
  const { editor } = useCurrentEditor();

  if (!editor) return null;

  return (
    <DragHandle
      editor={editor}
      computePositionConfig={{ placement: "left-start", strategy: "absolute" }}
    >
      <div className="pr-2">
        <div className="fern-hover-handle flex flex-col items-center rounded-md p-1.5 hover:bg-gray-500/40">
          <GripVertical className="text-muted-foreground" size={16} />
        </div>
      </div>
    </DragHandle>
  );
}
