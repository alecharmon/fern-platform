import { cn } from "@fern-docs/components/cn";
import type { ReactNode } from "react";

export const CircleStopIcon = ({
    fill = "currentColor",
    className
}: {
    fill?: string;
    className?: string;
}): ReactNode => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={fill}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn("size-icon", className)}
    >
        <circle cx="12" cy="12" r="10" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
);
