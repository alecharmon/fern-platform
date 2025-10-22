"use client";

import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { cn } from "@/utils/utils";

export function NavbarWrapper({ children }: { children: React.ReactNode }) {
    const [isCollapsed] = useIsSidebarCollapsed();

    return (
        <div
            className={cn(
                "flex h-full w-fit max-w-full flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--sidebar)] md:border-0 md:py-4 md:pl-4 md:pr-4 md:transition-[width] md:duration-300 md:ease-in-out",
                isCollapsed ? "" : "md:w-[var(--sidebar-width)]"
            )}
        >
            {children}
        </div>
    );
}
