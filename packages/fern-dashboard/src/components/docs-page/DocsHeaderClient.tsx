"use client";

import type { ReactNode } from "react";
import { GoToEditorButton } from "@/components/docs-page/GoToEditorButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
import type { DocsUrl } from "@/utils/types";

/** Minimal user info needed by the header — avoids sending the full session (including accessToken) to the client. */
export interface DocsHeaderUserInfo {
    sub: string;
    name?: string | null;
}

/**
 * Client-side docs header component. By rendering as a client component,
 * the DOM stays stable across tab navigations (React reconciliation sees
 * no changes and skips the update), avoiding any flash/thrash.
 */
export function DocsHeaderClient({
    docsUrl,
    user,
    badgeStatus = "live",
    actionsMenu
}: {
    docsUrl: DocsUrl;
    user: DocsHeaderUserInfo;
    badgeStatus?: StatusBadgeType;
    actionsMenu?: ReactNode;
}) {
    return (
        <PageHeader
            title={
                <span className="break-all">
                    <a
                        href={new URL(`https://${docsUrl}`).toString()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg hover:bg-gray-200 px-2 py-1 -mx-2 -my-1"
                    >
                        {docsUrl}
                    </a>
                </span>
            }
            titleRightContent={<StatusBadge status={badgeStatus} />}
            farRightContent={
                docsUrl && (
                    <div className="flex items-center gap-2">
                        <GoToEditorButton
                            docsUrl={docsUrl}
                            user={user}
                            disabled={false}
                            variant="default"
                            content={"Edit"}
                            isValidatingSource={false}
                        />
                        {actionsMenu}
                    </div>
                )
            }
        />
    );
}
