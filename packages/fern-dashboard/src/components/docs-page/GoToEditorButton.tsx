"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Loader2, Plus } from "lucide-react";

import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { generateBranchName } from "@fern-docs/components/navigation/local-storage";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { ROOT_SLUG_ALIAS, constructEditorSlug } from "@/utils/editor-routing";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";

import { Button } from "../ui/button";

export function GoToEditorButton({
    docsUrl,
    session,
    disabled = false,
    isValidatingSource
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    disabled?: boolean;
    disabledReason?: string;
    isValidatingSource?: boolean;
}) {
    const orgName = useOrgName();
    const [isLoading, setIsLoading] = useState(false);

    const newBranchName = useMemo(
        () => generateBranchName(session.user.sub, session.user.name),
        [session.user.name, session.user.sub]
    );

    const editorSlug = useMemo(() => {
        return constructEditorSlug({
            orgName,
            docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
            branchName: newBranchName,
            slug: ROOT_SLUG_ALIAS
        });
    }, [orgName, docsUrl, newBranchName]);

    return (
        <div className="flex w-fit flex-row items-center gap-2">
            <FernTooltipProvider>
                <FernTooltip
                    content={isValidatingSource ? "Validating source repo..." : undefined}
                    variant="dashboard"
                    delayDuration={0}
                    side="bottom"
                    className="bg-gray-1200 rounded-md text-white"
                >
                    <span className="pointer-events-auto">
                        <Button disabled={isLoading || disabled || isValidatingSource} asChild={!disabled}>
                            <Link
                                className="flex flex-row items-center gap-1"
                                href={editorSlug}
                                onClick={() => {
                                    setIsLoading(true);
                                }}
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <>
                                        <Plus />
                                        New session
                                    </>
                                )}
                            </Link>
                        </Button>
                    </span>
                </FernTooltip>
            </FernTooltipProvider>
        </div>
    );
}
