"use client";

import { ArrowUpLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useOrgName } from "@/app/[orgName]/context/OrgNameContext";
import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useBranch } from "@/providers/BranchContext";
import { useDevMode } from "@/providers/DevModeProvider";
import { useIsPreviewMode } from "@/providers/EditorPreviewProvider";
import { useGitHubRepo } from "@/providers/GitHubRepoContext";
import { useGitPrInfo } from "@/providers/GitPRContext";
import type { DocsUrl } from "@/utils/types";
import { ProfileImage } from "../layout/ProfileImage";
import { Button } from "../ui/button";
import { DashboardTooltip } from "./DashboardTooltip";
import { DevModeSwitcher } from "./DevModeSwitcher";
import { EditorNextStepsModal } from "./EditorNextStepsModal";
import { FilesDropdown } from "./FilesDropdown";
import { CelebrationRocketButton } from "./git/CelebrationRocketButton";
import { ClickablePrNumber } from "./git/ClickablePrNumber";
import { CommitButton } from "./git/CommitButton";
import { PRStatusDropdown } from "./git/PRStatusDropdown";
import { PRTitleEditor } from "./git/PRTitleEditor";

export function HeaderToolbar({ session, docsUrl }: { session: Auth0SessionData; docsUrl: DocsUrl }) {
    const { name, picture } = session.user;
    const { gitPrUrl, setPrUrl } = useGitPrInfo();
    const { branch } = useBranch();
    const isEditingDisabled = useEditingDisabled();
    const { owner, repo, baseBranch } = useGitHubRepo();
    const { isPreviewMode } = useIsPreviewMode();
    const { isDevModeDisabled } = useDevMode();
    const orgName = useOrgName();

    const [showRocketButton, setShowRocketButton] = useState(false);
    const [showCelebrationModal, setShowCelebrationModal] = useState(false);

    useEffect(() => {
        if (isPreviewMode) {
            return;
        }
        // NOTE: This is a temporary solution to persist the PR URL across route changes/refreshes.
        const prUrl = localStorage.getItem(`gitPrUrl-${branch}`);
        if (prUrl) {
            setPrUrl(prUrl);
        }
    }, [branch, setPrUrl, isPreviewMode]);

    // Show rocket button if there's a PR URL (existing PR) or if user has committed
    useEffect(() => {
        if (isPreviewMode) {
            return;
        }
        if (gitPrUrl && !showRocketButton) {
            setShowRocketButton(true);
        }
    }, [gitPrUrl, showRocketButton, isPreviewMode]);

    const handleCelebrationModalChange = useCallback(
        (open: boolean) => {
            if (!open && !showRocketButton) {
                // When modal closes for the first time, show the rocket button
                setTimeout(() => {
                    setShowRocketButton(true);
                }, 300); // Slight delay for smooth transition
            }
            setShowCelebrationModal(open);
        },
        [showRocketButton]
    );

    const handleRocketClick = useCallback(() => {
        setShowCelebrationModal(true);
    }, []);

    return (
        <>
            <div className="bg-background flex h-(--header-toolbar-height-mobile) flex-wrap items-center justify-center gap-2 border-b border-gray-500 px-2 py-2 shadow-sm md:h-(--header-toolbar-height) md:py-1">
                <div className="flex w-full flex-1 items-center gap-1 text-left md:w-auto">
                    <Button className="px-2" variant="ghost" size="iconSm" asChild>
                        <Link href={`/${orgName}/docs/${encodeURIComponent(docsUrl)}`}>
                            <ArrowUpLeft className="size-5" />
                        </Link>
                    </Button>
                    <PRTitleEditor
                        owner={owner}
                        repo={repo}
                        baseBranch={baseBranch}
                        branch={branch}
                        gitPrUrl={gitPrUrl}
                    />
                    <ClickablePrNumber />
                    <PRStatusDropdown
                        owner={owner}
                        repo={repo}
                        baseBranch={baseBranch}
                        branch={branch}
                        gitPrUrl={gitPrUrl}
                    />
                    <CelebrationRocketButton isVisible={showRocketButton} onClick={handleRocketClick} />
                </div>
                <div className="flex items-center gap-2">
                    <DashboardTooltip content={isEditingDisabled ? undefined : `Editing as ${name}`}>
                        <ProfileImage
                            picture={picture}
                            name={name}
                            className="ring-primary border-3 size-[34px] border-white ring-2"
                        />
                    </DashboardTooltip>
                </div>
                <div className="flex items-center justify-end gap-2 sm:flex-1 sm:shrink-0">
                    <DashboardTooltip
                        content={
                            isDevModeDisabled
                                ? "Dev mode unavailable for API reference pages"
                                : "Edit source code in dev mode"
                        }
                        hideInnerSpan
                    >
                        <div className="pointer-events-auto hidden items-center justify-center md:flex">
                            <DevModeSwitcher />
                        </div>
                    </DashboardTooltip>
                    <FilesDropdown />
                    <CommitButton
                        onShowCelebrationModal={(show) => {
                            setShowCelebrationModal(show);
                        }}
                    />
                </div>
            </div>

            <EditorNextStepsModal open={showCelebrationModal} onOpenChange={handleCelebrationModalChange} />
        </>
    );
}
