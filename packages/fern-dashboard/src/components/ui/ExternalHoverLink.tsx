"use client";

import { useState } from "react";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

import { cn } from "@/utils/utils";

export function ExternalHoverLink({ href, displayHref }: { href: string; displayHref?: string }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="w-full">
            <a
                href={href}
                target="_blank"
                className="dashboard-link"
                onMouseEnter={() => {
                    setIsHovered(true);
                }}
                onMouseLeave={() => {
                    setIsHovered(false);
                }}
            >
                <span className="truncate">{displayHref ?? href}</span>
                <ArrowTopRightOnSquareIcon className={cn("size-4 shrink-0", !isHovered && "invisible")} />
            </a>
        </div>
    );
}
