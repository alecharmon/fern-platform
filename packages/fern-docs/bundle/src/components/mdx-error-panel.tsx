"use client";

import GradientExclamation from "@fern-docs/components/GradientExclamation";

export interface MdxErrorPanelProps {
    error: Error;
    className?: string;
}

export function MdxErrorPanel({ error, className }: MdxErrorPanelProps) {
    return (
        <div className={className}>
            <div className="flex flex-col items-center justify-center gap-4 py-16">
                <GradientExclamation />
                <div className="flex flex-col text-center gap-2">
                    <h1>Sorry, we failed to render this page</h1>
                    <p className="text-(color:--grayscale-a9)">
                        We&apos;ve been notified so we can fix this for next time.
                    </p>
                </div>
            </div>
        </div>
    );
}
