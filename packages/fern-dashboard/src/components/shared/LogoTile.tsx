import type { ReactNode } from "react";

import { cn } from "@/utils/utils";

interface LogoTileProps {
    children: ReactNode;
    className?: string;
}

export function LogoTile({ children, className }: LogoTileProps) {
    return (
        <div
            className={cn(
                "border border-border flex size-16 items-center justify-center rounded-xl bg-background shadow-xl",
                className
            )}
        >
            {children}
        </div>
    );
}
