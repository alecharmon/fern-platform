import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import TableHeaderActionsMenu from "./TableHeaderActionsMenu";

export default function TableHeaderNodeView(props: NodeViewProps) {
    return (
        <NodeViewWrapper className="group flex flex-col justify-center">
            <div className="table-header-actions-menu -mt-4 flex w-full justify-center">
                <TableHeaderActionsMenu {...props} />
            </div>
            <NodeViewContent />
        </NodeViewWrapper>
    );
}
