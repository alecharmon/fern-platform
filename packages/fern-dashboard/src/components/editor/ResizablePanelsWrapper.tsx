"use client";

import { GripVertical } from "lucide-react";
import type React from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useDevMode } from "@/providers/DevModeProvider";

interface ResizablePanelsWrapperProps {
    left: React.ReactNode;
    right: React.ReactNode;
}

export function ResizablePanelsWrapper({ left, right }: ResizablePanelsWrapperProps) {
    const { panelOpen } = useDevMode();

    // If panel is not open, just render left content without panels
    if (!panelOpen) {
        return <div className="h-full">{left}</div>;
    }

    return (
        <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={70} minSize={30} maxSize={85}>
                {left}
            </Panel>
            <PanelResizeHandle className="group relative w-1 bg-transparent hover:bg-primary/10">
                {/* Subtle divider line */}
                <div className="absolute inset-y-0 left-0 w-px bg-border/50" />

                {/* VS Code-style split arrow icon - appears on hover */}
                <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="bg-background/95 border-border rounded-sm border p-0.5 shadow-sm">
                        <GripVertical className="text-muted-foreground h-3 w-3" />
                    </div>
                </div>
            </PanelResizeHandle>
            <Panel defaultSize={30} minSize={15} maxSize={70}>
                {right}
            </Panel>
        </PanelGroup>
    );
}
