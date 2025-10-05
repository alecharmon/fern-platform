import type React from "react";

import { cn } from "../cn";

export function MobileSidebarHeaderLinks({
    children,
    hideInDesktop = true
}: {
    children: React.ReactNode;
    hideInDesktop?: boolean;
}) {
    if (!children) {
        return null;
    }
    return (
        <div
            className={cn("border-border-concealed -mx-4 mt-4 flex list-none flex-col gap-2 border-t p-4 [&>*]:flex", {
                "lg:hidden": hideInDesktop
            })}
        >
            {children}
        </div>
    );
}
