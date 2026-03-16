"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/utils/utils";

export function ExternalHoverLink({ href, displayHref }: { href: string; displayHref?: string }) {
    const [isHovered, setIsHovered] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef<HTMLSpanElement>(null);

    const checkTruncation = useCallback(() => {
        const el = textRef.current;
        if (el != null) {
            setIsTruncated(el.scrollWidth > el.clientWidth);
        }
    }, []);

    const displayText = displayHref ?? href;

    return (
        <div className="w-full">
            <a
                href={href}
                target="_blank"
                className="dashboard-link"
                onMouseEnter={() => {
                    setIsHovered(true);
                    checkTruncation();
                }}
                onMouseLeave={() => {
                    setIsHovered(false);
                }}
            >
                <TooltipProvider>
                    <Tooltip content={isTruncated ? displayText : undefined}>
                        <span ref={textRef} className="truncate">
                            {displayText}
                        </span>
                    </Tooltip>
                </TooltipProvider>
                <ExternalLink className={cn("size-4 shrink-0", !isHovered && "invisible")} />
            </a>
        </div>
    );
}
