"use client";

import { useCallback, useState } from "react";
import { useConnectGithubRepo } from "@/hooks/useConnectGithubRepo";
import type { DocsUrl } from "@/utils/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { GithubRepoInput } from "./GithubRepoInput";

export function SetGithubSourcePopover({
    docsUrl,
    children,
    setIsSaving,
    initialUrl
}: {
    docsUrl: DocsUrl;
    children: React.ReactNode;
    setIsSaving: (isSaving: boolean) => void;
    initialUrl?: string;
}) {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    const { connectRepo } = useConnectGithubRepo({
        docsUrl,
        onStart: () => {
            setIsSaving(true);
            setIsPopoverOpen(false);
        },
        onFinally: () => {
            setIsSaving(false);
        }
    });

    const handleConnectRepo = useCallback(
        async (canonicalUrl: string) => {
            await connectRepo({ canonicalUrl });
        },
        [connectRepo]
    );

    return (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="border-border w-80 rounded-xl border p-0" align="start">
                <div className="flex flex-col p-3">
                    <GithubRepoInput
                        docsUrl={docsUrl}
                        initialUrl={isPopoverOpen ? initialUrl : ""}
                        onSave={handleConnectRepo}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}
