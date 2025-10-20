import React from "react";

import { cn } from "@/utils/utils";

export declare namespace AlertIconAnimated {
    export interface Props {
        className?: string;
        strokeColor?: string;
    }
}

export function AlertIconAnimated({ className, strokeColor = "var(--green-1100)" }: AlertIconAnimated.Props) {
    return (
        <svg
            className={cn("alert", className)}
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                d="M10 6.25V10.625M10 13.75H10.0083M8.6025 2.91583L1.79083 14.375C1.34833 15.1417 1.90333 16.125 2.81333 16.125H17.1867C18.0967 16.125 18.6517 15.1417 18.2092 14.375L11.3975 2.91583C10.955 2.14917 9.845 2.14917 9.4025 2.91583H8.6025Z"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-stroke-color transition"
            />
        </svg>
    );
}
