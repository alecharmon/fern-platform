"use client";

import { Code2 } from "lucide-react";
import type React from "react";
import { EditInDevModeButton } from "./EditInDevModeButton";

interface NodeHoverWrapperProps {
    name: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    icon: React.ReactNode;
}

const NodeHoverWrapper = ({ name, children, icon, actions }: NodeHoverWrapperProps) => {
    return (
        <div className="group relative">
            {/* Invisible hover area to prevent badge from disappearing */}
            <div className="absolute -top-14 left-0 right-0 h-16 z-10" />

            {/* Hover outline - only visible on group hover */}
            <div className="pointer-events-none absolute -inset-2 hidden rounded-lg border-2 border-[var(--fern-border)] border-dashed group-hover:block" />

            <div className="absolute right-0 -top-13 z-10 items-center hidden gap-2 group-hover:flex">
                <div className="flex items-center gap-1 rounded-[10px] border border-[var(--fern-border)] bg-popover p-1 text-sm shadow-lg">
                    <div className="bg-[var(--fern-green-300)] h-[32px] p-1 px-2.5 rounded-md flex gap-2 items-center text-primary font-normal">
                        {icon}
                        {name}
                    </div>
                    {actions != null && actions}
                </div>
            </div>

            {children}
        </div>
    );
};

export const CustomElementHoverWrapper = ({ children }: { children: React.ReactNode }) => {
    return (
        <NodeHoverWrapper
            name="Custom Element"
            icon={<Code2 className="size-4" />}
            actions={<EditInDevModeButton variant="default" size="sm" />}
        >
            {children}
        </NodeHoverWrapper>
    );
};
