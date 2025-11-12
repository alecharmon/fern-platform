"use client";

import { Code2, Sigma } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";
import { EditInDevModeButton } from "./EditInDevModeButton";

interface NodeHoverWrapperProps {
    name: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    icon: React.ReactNode;
    enableHoverBridge?: boolean;
}

const NodeHoverWrapper = ({ name, children, icon, actions, enableHoverBridge = true }: NodeHoverWrapperProps) => {
    const [isActive, setIsActive] = useState(false);
    const hideTimeoutRef = useRef<number | undefined>(undefined);

    const HIDE_DELAY_MS = 500; // 500ms grace period

    const open = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        setIsActive(true);
    };

    const scheduleClose = () => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = window.setTimeout(() => setIsActive(false), HIDE_DELAY_MS);
    };

    return (
        <div className="group relative" onMouseEnter={open} onMouseLeave={scheduleClose}>
            {/* Invisible hover area to prevent badge from disappearing */}
            {enableHoverBridge && <div className="absolute -top-14 right-0 w-64 h-16 z-10" />}

            {/* Hover outline - only visible on group hover */}
            <div className="pointer-events-none absolute -inset-2 -inset-x-3 hidden rounded-lg border-2 border-[var(--fern-border)] border-dashed group-hover:block" />

            <div
                className={`absolute right-0 -top-13 z-10 items-center gap-2 ${isActive ? "flex" : "hidden"} group-hover:flex`}
                onMouseEnter={open}
                onMouseLeave={scheduleClose}
            >
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

export const MathNodeWrapper = ({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) => {
    return (
        <NodeHoverWrapper
            name="Math"
            icon={<Sigma className="size-4" />}
            actions={<EditInDevModeButton variant="default" size="sm" />}
            enableHoverBridge={!inline}
        >
            {children}
        </NodeHoverWrapper>
    );
};
