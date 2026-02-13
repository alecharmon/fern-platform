"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { GithubLogo } from "../auth/GithubLogo";
import { AddCollaboratorModal } from "../shared/AddCollaboratorModal";
import { Note } from "./Note";

interface AddCollaboratorBannerProps {
    docsUrl: string;
    sourceRepoOwner?: string;
    sourceRepoName?: string;
    collaboratorCount?: number;
}

const _BOT_OWNER = "fern-support";

export function AddCollaboratorBanner({
    docsUrl,
    sourceRepoOwner,
    sourceRepoName,
    collaboratorCount
}: AddCollaboratorBannerProps) {
    const orgName = useOrgNameFromPathname();
    const [currentOwner, setCurrentOwner] = useState<string | null>(sourceRepoOwner ?? null);
    const [isAddCollaboratorModalOpen, setIsAddCollaboratorModalOpen] = useState(false);

    const handleAddCollaboratorSuccess = () => {
        setCurrentOwner(null);
    };

    const isNotInBotAccount = currentOwner !== _BOT_OWNER || sourceRepoOwner !== _BOT_OWNER;
    if (isNotInBotAccount) {
        return null;
    }

    if (collaboratorCount != null && collaboratorCount > 0) {
        return null;
    }

    // Use the source repo name from git URL if available, otherwise fall back to docsUrl
    const repoName = sourceRepoName ?? docsUrl.replace(/\.docs\.buildwithfern\.com$/, "");

    // Show add collaborator banner if repo exists in bot account
    return (
        <>
            <AddCollaboratorModal
                open={isAddCollaboratorModalOpen}
                onOpenChange={setIsAddCollaboratorModalOpen}
                repoName={repoName}
                docsUrl={docsUrl}
                orgName={orgName}
                onSuccess={handleAddCollaboratorSuccess}
            />

            <Note
                title="We've setup a GitHub repo for you. Become a collaborator to view and manage changes."
                iconClassName="w-fit h-fit"
                icon={<GithubLogo width={24} height={24} variant="circle" />}
                className="font-bold"
                rightContent={
                    <Button size="sm" className="font-normal" onClick={() => setIsAddCollaboratorModalOpen(true)}>
                        Add collaborator
                    </Button>
                }
            />
        </>
    );
}
