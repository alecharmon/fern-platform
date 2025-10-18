"use client";

import type React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useDevMode } from "@/providers/DevModeProvider";
import { cn } from "@/utils/utils";

interface ResizablePanelsWrapperProps {
    left: React.ReactNode;
    right: React.ReactNode;
}

export function ResizablePanelsWrapper({ left, right }: ResizablePanelsWrapperProps) {
    const { panelOpen } = useDevMode();

    return (
        <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={70} minSize={30} maxSize={85}>
                {left}
            </Panel>
            <PanelResizeHandle
                className={cn("group relative w-4 bg-transparent", !panelOpen && "hidden")}
                style={{ cursor: "col-resize !important" }}
            >
                <div className="absolute inset-y-0 left-1 flex flex-col items-center justify-center">
                    <div className="absolute top-6 bottom-0 w-px bg-transparent group-hover:bg-gradient-to-b group-hover:from-transparent group-hover:from-0 group-hover:via-green-1100 group-hover:via-[64px] group-hover:to-green-1100 group-data-[resize-handle-active]:bg-gradient-to-b group-data-[resize-handle-active]:from-transparent group-data-[resize-handle-active]:from-0 group-data-[resize-handle-active]:via-green-1100 group-data-[resize-handle-active]:via-[64px] group-data-[resize-handle-active]:to-green-1100" />
                    <div className="relative z-10 h-6 w-2 rounded-full border border-gray-500 bg-white group-hover:border-green-1100 group-hover:bg-green-1100 group-data-[resize-handle-active]:border-green-1100 group-data-[resize-handle-active]:bg-green-1100" />
                </div>
            </PanelResizeHandle>
            <Panel defaultSize={30} minSize={15} maxSize={70} className={panelOpen ? "" : "hidden"}>
                {right}
            </Panel>
        </PanelGroup>
    );
}
