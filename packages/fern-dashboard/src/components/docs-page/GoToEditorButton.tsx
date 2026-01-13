"use client";

import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import { constructEditorSlug, generateBranchName, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";

import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { type ComponentProps, useEffect, useMemo, useState } from "react";

import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import preloadEditorData from "@/app/services/docs-loader/preloadEditorData";
import type { DocsUrl, EncodedDocsUrl } from "@/utils/types";
import { docsPermissionScope } from "../auth/authz";
import { AuthZButton } from "../auth/authz/AuthZButton";

export function GoToEditorButton({
    docsUrl,
    session,
    disabled = false,
    isValidatingSource,
    content,
    variant = "default",
    size
}: {
    docsUrl: DocsUrl;
    session: Auth0SessionData;
    disabled?: boolean;
    disabledReason?: string;
    isValidatingSource?: boolean;
    content?: React.ReactNode;
    size?: ComponentProps<typeof AuthZButton>["size"];
    variant?: ComponentProps<typeof AuthZButton>["variant"];
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

    useEffect(() => {
        if (!disabled) {
            console.debug("[GoToEditorButton] Preloading editor data for", docsUrl, newBranchName);
            void preloadEditorData({
                docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
                host: window.location.host,
                branch: newBranchName
            }).catch((error) => {
                // Log error but don't block navigation
                console.error("Failed to preload editor data:", error);
            });
        }
    }, [disabled, docsUrl, newBranchName]);

    const handleClick = () => {
        setIsLoading(true);
    };

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
                        <AuthZButton
                            permission="edit"
                            disabled={isLoading || disabled || isValidatingSource}
                            loading={isLoading}
                            variant={variant}
                            permissionScope={docsPermissionScope(docsUrl)}
                            size={size}
                        >
                            <Link
                                className="flex flex-row items-center gap-1"
                                href={editorSlug}
                                onClick={handleClick}
                                prefetch={!disabled}
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    (content ?? (
                                        <>
                                            <Plus />
                                            New session
                                        </>
                                    ))
                                )}
                            </Link>
                        </AuthZButton>
                    </span>
                </FernTooltip>
            </FernTooltipProvider>
        </div>
    );
}
