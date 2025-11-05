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
                d="M2.24711 13.4381C1.52595 14.6881 2.42809 16.2501 3.8712 16.2501H16.1284C17.5715 16.2501 18.4737 14.6881 17.7525 13.4381L11.6239 2.81522C10.9024 1.56452 9.09727 1.56452 8.37571 2.81522L2.24711 13.4381Z"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="alert-triangle transition-stroke-color transition"
            />
            <path
                d="M9.99981 7.50011V10.6251"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="alert-line transition-stroke-color transition"
            />
            <path
                d="M9.99981 13.1251H10.0061V13.1314H9.99981V13.1251"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="alert-dot transition-stroke-color transition"
            />
        </svg>
    );
}
