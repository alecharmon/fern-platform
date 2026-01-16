"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { GithubLogo } from "../auth/GithubLogo";
import { Note } from "./Note";
import { TransferRepoModal } from "./TransferRepoModal";

interface TransferRepoOwnershipBannerProps {
    docsUrl: string;
    sourceRepoOwner?: string;
}

const _BOT_OWNER = "fern-support";

export function TransferRepoOwnershipBanner({ docsUrl, sourceRepoOwner }: TransferRepoOwnershipBannerProps) {
    const orgName = useOrgNameFromPathname();
    const [currentOwner, setCurrentOwner] = useState<string | null>(sourceRepoOwner ?? null);
    const [error, _setError] = useState<string | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const handleTransferSuccess = (newRepoUrl: string) => {
        // Extract the new owner from the URL
        const urlParts = newRepoUrl.replace("https://github.com/", "").split("/");
        if (urlParts.length >= 2) {
            setCurrentOwner(urlParts[0] ?? null);
        }
    };

    // Check if repo is still in the bot's account (not yet transferred)
    // If we're loading this again after the repo has been transferred, we'll need to check the sourceRepoOwner
    const isNotInBotAccount = currentOwner !== _BOT_OWNER || sourceRepoOwner !== _BOT_OWNER;
    // Only show the banner if source repo is owned by fern-support
    if (isNotInBotAccount) {
        return null;
    }

    // Extract repo name from docsUrl
    const repoName = docsUrl.replace(/\.docs\.buildwithfern\.com$/, "");

    // Show transfer banner if repo exists in bot account
    return (
        <>
            <TransferRepoModal
                open={isTransferModalOpen}
                onOpenChange={setIsTransferModalOpen}
                currentOwner={currentOwner}
                repoName={repoName}
                orgName={orgName}
                onSuccess={handleTransferSuccess}
            />

            <Note
                title="We’ve setup a GitHub repo for you. Transfer it to your org to take ownership."
                iconClassName="w-fit h-fit"
                icon={<GithubLogo width={24} height={24} variant="circle" />}
                className="items-center font-bold"
                rightContent={
                    <Button size="sm" className="font-normal" onClick={() => setIsTransferModalOpen(true)}>
                        Transfer
                    </Button>
                }
            >
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </Note>
        </>
    );
}
