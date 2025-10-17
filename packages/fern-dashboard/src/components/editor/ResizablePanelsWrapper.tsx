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
                className={cn("group relative w-4 !cursor-col-resize bg-transparent", !panelOpen ? "hidden" : "")}
                disabled={!panelOpen}
            >
                {/* Vertical line centered in the drag area */}
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-primary/20 group-data-[resize-handle-active]:bg-primary/50" />
            </PanelResizeHandle>
            <Panel defaultSize={30} minSize={15} maxSize={70} className={panelOpen ? "" : "hidden"}>
                {right}
            </Panel>
        </PanelGroup>
    );
}
