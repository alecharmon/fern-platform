"use client";

import type React from "react";
import { cn } from "@/utils/utils";

export const PANEL_CARD_CLASS =
    "border-1 rounded-b-none border-b-0 bg-background border-border relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-lg";

export function PanelCardBody({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn(PANEL_CARD_CLASS, className)}>{children}</div>;
}

export function PanelShell({ header, children }: { header?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex h-full flex-col">
            {header}
            <PanelCardBody>{children}</PanelCardBody>
        </div>
    );
}
