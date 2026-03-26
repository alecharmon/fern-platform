"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

interface ToolLayoutProps {
    title: string;
    description?: string;
    /** Max width class — defaults to "max-w-2xl" */
    maxWidth?: string;
    children: ReactNode;
}

/**
 * Shared layout wrapper for all internal tool pages.
 * Provides consistent padding, back link, and heading.
 */
export function ToolLayout({ title, description, maxWidth = "max-w-2xl", children }: ToolLayoutProps) {
    const searchParams = useSearchParams();
    const queryString = searchParams.toString();
    const backLink = queryString ? `/?${queryString}` : "/";

    return (
        <div className="flex h-full flex-col items-center p-8">
            <div className={`w-full ${maxWidth} space-y-8`}>
                <div className="space-y-4">
                    <Link
                        href={backLink}
                        className="text-gray-1000 hover:text-gray-1200 inline-flex items-center gap-1.5 text-xs transition-colors"
                    >
                        <ArrowLeft className="size-3" />
                        Back to tools
                    </Link>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                        {description && <p className="text-gray-1000 text-sm">{description}</p>}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}
