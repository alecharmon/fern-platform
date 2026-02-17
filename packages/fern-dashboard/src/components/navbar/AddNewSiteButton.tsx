"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsLimitReachedDialog } from "@/components/entitlements/DocsLimitReachedDialog";
import { useIsSidebarCollapsed } from "@/state/sidebar-collapse";
import { useEntitlement } from "@/state/useEntitlement";
import { cn } from "@/utils/utils";

interface AddNewSiteButtonProps {
    orgName: Auth0OrgName;
    isCreateDocsNewSiteEnabled: boolean;
}

export function AddNewSiteButton({ orgName, isCreateDocsNewSiteEnabled }: AddNewSiteButtonProps) {
    const [isCollapsed] = useIsSidebarCollapsed();
    const { remaining } = useEntitlement("docs_sites");
    const [showLimitDialog, setShowLimitDialog] = useState(false);

    // Don't render when collapsed (it's in the popover instead)
    if (isCollapsed) {
        return null;
    }

    const href = isCreateDocsNewSiteEnabled
        ? `/get-started/${orgName}/docs`
        : "https://buildwithfern.com/learn/docs/getting-started/quickstart";

    const isAtLimit = remaining <= 0;

    return (
        <>
            {isAtLimit ? (
                <button
                    type="button"
                    onClick={() => setShowLimitDialog(true)}
                    className={cn(
                        "hidden md:flex",
                        "flex-1 flex-row gap-2 text-sm transition",
                        "hover:text-gray-1100 text-gray-900"
                    )}
                >
                    <div className="flex w-5 shrink-0 justify-center">
                        <div className="w-px bg-gray-700" />
                    </div>
                    <div className="flex min-w-0 items-center gap-2 py-2 pr-4">
                        <PlusIcon className="h-4 w-4" />
                        <div className="truncate">Add new site</div>
                    </div>
                </button>
            ) : (
                <Link
                    href={href}
                    className={cn(
                        "hidden md:flex",
                        "flex-1 flex-row gap-2 text-sm transition",
                        "hover:text-gray-1100 text-gray-900"
                    )}
                    target={isCreateDocsNewSiteEnabled ? "_self" : "_blank"}
                >
                    <div className="flex w-5 shrink-0 justify-center">
                        <div className="w-px bg-gray-700" />
                    </div>
                    <div className="flex min-w-0 items-center gap-2 py-2 pr-4">
                        <PlusIcon className="h-4 w-4" />
                        <div className="truncate">Add new site</div>
                    </div>
                </Link>
            )}
            <DocsLimitReachedDialog open={showLimitDialog} onOpenChange={setShowLimitDialog} orgName={orgName} />
        </>
    );
}
