"use client";

import { ArrowLeftRight, Loader2Icon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GithubLogo } from "../auth/GithubLogo";
import { DialogHeaderGradients } from "../shared/DialogHeaderGradients";
import { LogoTile } from "../shared/LogoTile";
import { SlideUpTransition } from "../transitions/SlideUpTransition";
import { Input } from "../ui/input";

interface TransferRepoModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentOwner: string;
    repoName: string;
    orgName: string;
    onSuccess: (newRepoUrl: string) => void;
}

export function TransferRepoModal({
    open,
    onOpenChange,
    currentOwner,
    repoName,
    orgName,
    onSuccess
}: TransferRepoModalProps) {
    const [newOwner, setNewOwner] = useState("");
    const [isTransferring, setIsTransferring] = useState(false);
    const [showSuccessState, setShowSuccessState] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newRepoUrl, setNewRepoUrl] = useState<string | null>(null);

    const handleTransfer = async () => {
        if (!newOwner.trim()) {
            setError("Please enter a GitHub username or organization");
            return;
        }

        setIsTransferring(true);
        setError(null);

        try {
            const response = await fetch("/api/transfer-github-repo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    orgName,
                    currentOwner,
                    repoName,
                    newOwner: newOwner.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to transfer repository");
            }

            const result = await response.json();

            // Show success state and store the new repo URL
            setNewRepoUrl(result.newRepoUrl);
            setShowSuccessState(true);
        } catch (err) {
            console.error("Error transferring repository:", err);
            if (err instanceof Error && err.message.includes("Repository has already been taken")) {
                setError(
                    "Repository transfer has already been initiated, please check the email associated with the GitHub username."
                );
            } else {
                setError("Failed to transfer repository. Please try again or contact support.");
            }
        } finally {
            setIsTransferring(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isTransferring) {
            handleTransfer();
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        // When modal closes, call onSuccess and reset state
        if (!newOpen && showSuccessState && newRepoUrl) {
            onSuccess(newRepoUrl);
        }

        // Reset state when closing
        if (!newOpen) {
            setShowSuccessState(false);
            setNewOwner("");
            setError(null);
            setNewRepoUrl(null);
        }

        onOpenChange(newOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-h-fit overflow-hidden sm:max-w-[500px]">
                <DialogHeaderGradients />

                {/* Icon flow visualization */}
                <div className="relative z-10 flex items-center justify-center gap-4 py-6">
                    {/* Fern logo */}
                    <LogoTile>
                        <Image src="/fern-leaf-green.svg" alt="Fern" width={24} height={24} />
                    </LogoTile>

                    {/* Arrow */}
                    <ArrowLeftRight className="text-muted-foreground h-5 w-5" />

                    {/* GitHub logo */}
                    <LogoTile className="text-muted-foreground">
                        <GithubLogo width={20} height={20} />
                    </LogoTile>
                </div>
                <div className="flex items-center justify-center h-full w-full bg-background z-1 border-border border-t py-6 px-10">
                    <AnimatePresence mode="wait">
                        {showSuccessState ? (
                            <SlideUpTransition>
                                <div className="relative z-10 pt-4 pb-6 flex flex-col items-center justify-center gap-2">
                                    <h2 className="text-2xl font-semibold">Transfer initiated</h2>
                                    <p className="text-muted-foreground max-w-[350px] text-center text-sm">
                                        Please check the email associated with the GitHub username.
                                    </p>
                                </div>
                            </SlideUpTransition>
                        ) : (
                            <div className="flex flex-col w-full">
                                <DialogHeader className="relative z-10">
                                    <DialogTitle className="text-center text-lg">
                                        Transfer ownership of <code>{repoName}</code> on GitHub
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground mx-auto text-center text-sm">
                                        This will allow you to edit your docs site with code.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="relative z-10 pt-6 pb-3">
                                    <div className="flex flex-col gap-1">
                                        <label htmlFor="newOwner" className="text-xs font-medium text-muted-foreground">
                                            New Owner
                                        </label>
                                        <div className="flex gap-3">
                                            <Input
                                                id="newOwner"
                                                placeholder="github-username"
                                                type="text"
                                                value={newOwner}
                                                onChange={(e) => setNewOwner(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                disabled={isTransferring}
                                                autoFocus
                                            />
                                            <Button
                                                onClick={handleTransfer}
                                                disabled={isTransferring || !newOwner.trim()}
                                            >
                                                {isTransferring ? (
                                                    <Loader2Icon className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <GithubLogo width={16} height={16} />
                                                )}
                                                <span className="flex items-center text-sm">
                                                    {isTransferring ? "Transferring..." : "Transfer repo"}
                                                </span>
                                            </Button>
                                        </div>
                                        {error && (
                                            <div className="flex flex-wrap break-word rounded-md bg-red-50 mt-3 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                                {error}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
}
