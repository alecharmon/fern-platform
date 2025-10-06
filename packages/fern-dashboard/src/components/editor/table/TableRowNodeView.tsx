import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import TableRowActionsMenu from "./TableRowActionsMenu";

export default function TableRowNodeView(props: NodeViewProps) {
    return (
        // Add negative margin & padding so that we add faux hoverslop to keep button easy to press
        <NodeViewWrapper className="group -ml-4 overflow-x-visible pl-4">
            <div className="relative">
                <div className="absolute -left-2.5 top-1.5 z-50 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100">
                    <TableRowActionsMenu {...props} />
                </div>
                <NodeViewContent />
            </div>
        </NodeViewWrapper>
    );
}
