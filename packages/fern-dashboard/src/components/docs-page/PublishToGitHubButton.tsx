"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { TransferRepoModal } from "./TransferRepoModal";

interface PublishToGitHubButtonProps {
    docsUrl: string;
    docsSiteName: string;
    sourceRepoOwner?: string;
}

const _BOT_OWNER = "fern-support";

export function PublishToGitHubButton({ docsUrl, docsSiteName, sourceRepoOwner }: PublishToGitHubButtonProps) {
    console.log({ docsUrl, sourceRepoOwner });
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
    console.log({ isNotInBotAccount, currentOwner, sourceRepoOwner });
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

            <div className="border-border bg-background flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                    <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <p className="text-foreground text-sm">
                        We've setup a GitHub repo for you. Transfer it to your org to take ownership.
                    </p>
                </div>
                <Button onClick={() => setIsTransferModalOpen(true)} size="sm" className="flex-shrink-0">
                    Transfer
                </Button>
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
    );
}
