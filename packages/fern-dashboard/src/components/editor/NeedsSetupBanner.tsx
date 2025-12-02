"use client";

import { Rocket } from "lucide-react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useIsPreviewMode } from "@/providers/EditorPreviewProvider";
import type { DocsUrl } from "@/utils/types";
import { FinishEditorSetupModal } from "../docs-page/visual-editor-section/FinishEditorSetupModal";
import { Button } from "../ui/button";

export function NeedsSetupBanner({ docsUrl, orgName }: { docsUrl: DocsUrl; orgName: Auth0OrgName }) {
    const { isPreviewMode } = useIsPreviewMode();

    if (!isPreviewMode) {
        return null;
    }

    return (
        <FinishEditorSetupModal
            docsUrl={docsUrl}
            orgName={orgName}
            trigger={
                <button>
                    <NeedsSetupBannerDisplay />
                </button>
            }
            showRefreshButtonOnSuccess
        />
    );
}

function NeedsSetupBannerDisplay() {
    return (
        <div className="w-full py-1 px-2 bg-gradient-to-r from-primary to-green-400 text-xs flex items-center text-left justify-between shadow-border shadow-2xl">
            <div className="pl-2 gap-0.5 text-white">
                <p className="text-sm font-medium">Preview Mode</p>
                <p className="text-xs">Connecting your repository is required before you can save your changes</p>
            </div>
            {/* This is wrapped in a div to prevent a button-within-button hydation error */}
            <Button size="sm" className="border-0" asChild>
                <div>
                    <Rocket className="size-4" />
                    Connect your repository
                </div>
            </Button>
        </div>
    );
}
