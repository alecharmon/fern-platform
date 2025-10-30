import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import TableRowActionsMenu from "./TableRowActionsMenu";

export default function TableRowNodeView(props: NodeViewProps) {
    return (
        <NodeViewWrapper className="group overflow-x-visible">
            <div className="relative">
                <div className="absolute -left-2.5 top-1.5 z-50 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100">
                    <TableRowActionsMenu {...props} />
                </div>
                <NodeViewContent />
            </div>
        </NodeViewWrapper>
    );
}
