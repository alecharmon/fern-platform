import { cn } from "@fern-docs/components/cn";
import type React from "react";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
    return <div className={cn("bg-(color:--grayscale-a3) rounded-3/2 animate-pulse", className)} {...props} />;
}

export { Skeleton };
