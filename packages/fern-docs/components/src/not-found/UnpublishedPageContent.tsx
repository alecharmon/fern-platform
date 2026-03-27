"use client";

import { Button } from "../FernButtonV2";
import { EmptyStateIcon } from "./EmptyStateIcon";

interface UnpublishedPageContentProps {
    dashboardHref: string;
}

export function UnpublishedPageContent({ dashboardHref }: UnpublishedPageContentProps) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
            <div className="flex max-w-[500px] flex-col items-center gap-6">
                <EmptyStateIcon />
                <div>
                    <h1 className="text-(color:--grayscale-12) mb-2 text-[1.75rem] font-bold">
                        {"This Docs site is unpublished"}
                    </h1>
                    <p className="text-(color:--grayscale-a11) text-base leading-relaxed">
                        {"If you're the owner, you can make it public from the Fern dashboard."}
                    </p>
                </div>
                <Button variant="default" asChild>
                    <a href={dashboardHref} target="_blank" rel="noopener noreferrer">
                        {"Open dashboard"}
                    </a>
                </Button>
                <p className="text-(color:--grayscale-a11) text-[0.8125rem]">
                    {"Still need help? Contact "}
                    <a href="mailto:support@buildwithfern.com" className="text-(color:--grayscale-a11) underline">
                        {"support@buildwithfern.com"}
                    </a>
                    {"."}
                </p>
            </div>
        </div>
    );
}
