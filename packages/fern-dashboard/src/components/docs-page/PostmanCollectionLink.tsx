"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/utils/utils";
import { PostmanLogoClassic } from "../auth/PostmanLogoClassic";

interface PostmanCollectionLinkProps {
    displayText: string;
    href?: string;
}

export function PostmanCollectionLink({ displayText, href }: PostmanCollectionLinkProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef<HTMLSpanElement>(null);

    const checkTruncation = useCallback(() => {
        const el = textRef.current;
        if (el != null) {
            setIsTruncated(el.scrollWidth > el.clientWidth);
        }
    }, []);

    const content = (
        <TooltipProvider>
            <Tooltip content={isTruncated ? displayText : undefined}>
                <span ref={textRef} className="min-w-0 truncate">
                    {displayText}
                </span>
            </Tooltip>
        </TooltipProvider>
    );

    if (href) {
        return (
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
                <div className="shrink-0">
                    <PostmanLogoClassic />
                </div>
                {content}
                <ExternalLink className={cn("size-4 shrink-0", !isHovered && "invisible")} />
            </a>
        );
    }

    return (
        <div className="flex min-w-0 items-center gap-2">
            <div className="shrink-0">
                <PostmanLogoClassic />
            </div>
            {content}
        </div>
    );
}
