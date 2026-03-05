"use client";

import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "@/utils/utils";

interface ExpandableSettingProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
}

function ExpandableSetting({ title, children, defaultOpen = false }: ExpandableSettingProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border-border border-b last:border-b-0">
            <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 py-3 text-left font-medium transition-colors hover:text-foreground/80"
                onClick={() => setIsOpen(!isOpen)}
            >
                <ChevronRightIcon
                    className={cn("text-muted-foreground size-4 shrink-0 transition-transform", isOpen && "rotate-90")}
                />
                {title}
            </button>
            {isOpen && <div className="pb-4 pl-6">{children}</div>}
        </div>
    );
}

interface MultiRepoSettingsSectionProps {
    children: ReactNode;
}

export function MultiRepoSettingsSection({ children }: MultiRepoSettingsSectionProps) {
    return (
        <div className="border-border mx-auto flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4">
            <div className="mb-2 font-bold">Multi-repo settings</div>
            <div className="flex flex-col">{children}</div>
        </div>
    );
}

export { ExpandableSetting };
