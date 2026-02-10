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
}

const _BOT_OWNER = "fern-support";

export function AddCollaboratorBanner({ docsUrl, sourceRepoOwner, sourceRepoName }: AddCollaboratorBannerProps) {
    const orgName = useOrgNameFromPathname();
    const [currentOwner, setCurrentOwner] = useState<string | null>(sourceRepoOwner ?? null);
    const [isAddCollaboratorModalOpen, setIsAddCollaboratorModalOpen] = useState(false);

    const handleAddCollaboratorSuccess = () => {
        // Optionally handle success (e.g., hide banner, show confirmation)
        setCurrentOwner(null); // Hide banner after adding collaborator
    };

    // Check if repo is still in the bot's account (not yet transferred)
    // If we're loading this again after the repo has been transferred, we'll need to check the sourceRepoOwner
    const isNotInBotAccount = currentOwner !== _BOT_OWNER || sourceRepoOwner !== _BOT_OWNER;
    // Only show the banner if source repo is owned by fern-support
    if (isNotInBotAccount) {
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
                        Add Collaborator
                    </Button>
                }
            />
        </>
    );
}
