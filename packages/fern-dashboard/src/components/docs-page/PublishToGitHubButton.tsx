"use client";

import { ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

import { TransferRepoModal } from "./TransferRepoModal";

interface PublishToGitHubButtonProps {
    docsUrl: string;
    docsSiteName: string;
}

export function PublishToGitHubButton({ docsUrl, docsSiteName }: PublishToGitHubButtonProps) {
    const orgName = useOrgNameFromPathname();
    const [downloadExists, setDownloadExists] = useState<boolean | null>(null);
    const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);
    const [currentOwner, setCurrentOwner] = useState<string | null>(null);
    const [repoName, setRepoName] = useState<string | null>(null);
    const [_isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // Check if the fern docs zip exists and if GitHub repo exists
    useEffect(() => {
        async function checkStatus() {
            try {
                // Check if download exists
                const downloadResponse = await fetch("/api/onboarding-assets/fern-docs-download", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ docsUrl })
                });

                if (downloadResponse.ok) {
                    const downloadData = await downloadResponse.json();
                    setDownloadExists(downloadData.exists);

                    // Check if GitHub repo already exists
                    const normalizedDocsUrl = docsUrl.replace(/\.docs\.buildwithfern\.com$/, "");
                    const repoCheckResponse = await fetch("/api/check-github-repo", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({ docsSiteUrl: normalizedDocsUrl })
                    });

                    if (repoCheckResponse.ok) {
                        const repoCheckData = await repoCheckResponse.json();
                        if (repoCheckData.exists) {
                            setGithubRepoUrl(repoCheckData.repoUrl);
                            setCurrentOwner(repoCheckData.owner);
                            setRepoName(repoCheckData.repoName);
                        }
                    }
                } else {
                    setDownloadExists(false);
                }
            } catch (err) {
                console.error("Error checking status:", err);
                setDownloadExists(false);
            }
        }

        void checkStatus();
    }, [docsUrl]);

    const _handlePublish = async () => {
        setIsPublishing(true);
        setError(null);

        try {
            // Get the download URL first
            const downloadResponse = await fetch("/api/onboarding-assets/fern-docs-download", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ docsUrl })
            });

            if (!downloadResponse.ok) {
                throw new Error("Failed to get download URL");
            }

            const downloadData = await downloadResponse.json();

            if (!downloadData.exists || !downloadData.downloadUrl) {
                throw new Error("Fern docs not found. Please create docs first.");
            }

            // Now publish to GitHub
            // Normalize docsUrl (remove .docs.buildwithfern.com suffix if present)
            const normalizedDocsUrl = docsUrl.replace(/\.docs\.buildwithfern\.com$/, "");

            const publishResponse = await fetch("/api/publish-to-github", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    orgName,
                    docsSiteUrl: normalizedDocsUrl,
                    docsSiteName: docsSiteName,
                    fernDocsDownloadUrl: downloadData.downloadUrl
                })
            });

            if (!publishResponse.ok) {
                const errorData = await publishResponse.json();
                throw new Error(errorData.error || "Failed to publish to GitHub");
            }

            const result = await publishResponse.json();
            setGithubRepoUrl(result.githubRepoUrl);

            // Extract owner and repo name from the URL
            const urlParts = result.githubRepoUrl.replace("https://github.com/", "").split("/");
            if (urlParts.length >= 2) {
                setCurrentOwner(urlParts[0]);
                setRepoName(urlParts[1]);
            }
        } catch (err) {
            console.error("Error publishing to GitHub:", err);
            setError(err instanceof Error ? err.message : "Failed to publish");
        } finally {
            setIsPublishing(false);
        }
    };

    // Don't render anything while checking existence
    if (downloadExists === null) {
        return null;
    }

    // Don't render if the download doesn't exist (no docs to publish)
    if (!downloadExists) {
        return null;
    }

    const handleTransferSuccess = (newRepoUrl: string) => {
        setGithubRepoUrl(newRepoUrl);

        // Extract the new owner from the URL
        const urlParts = newRepoUrl.replace("https://github.com/", "").split("/");
        if (urlParts.length >= 2) {
            setCurrentOwner(urlParts[0] ?? null);
            // Repo name stays the same
        }
    };

    // Check if repo is still in the bot's account (not yet transferred)
    const botOwner = process.env.NEXT_PUBLIC_FERN_DEMO_CREATION_BOT_OWNER || "fern-support";
    const isInBotAccount = currentOwner === botOwner;

    const renderTransferButton = githubRepoUrl && currentOwner && repoName && isInBotAccount;
    if (!renderTransferButton) {
        return null;
    }

    // Show "Publish to GitHub" button (and transfer button if repo exists in bot account)
    return (
        <>
            <div className="flex w-fit flex-col gap-2">
                <p>GitHub</p>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setIsTransferModalOpen(true)}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1.5"
                    >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        Transfer Repository
                    </Button>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <TransferRepoModal
                open={isTransferModalOpen}
                onOpenChange={setIsTransferModalOpen}
                currentOwner={currentOwner}
                repoName={repoName}
                orgName={orgName}
                onSuccess={handleTransferSuccess}
            />
        </>
    );
}
