"use client";

import { Loader2Icon, SendIcon, UserPlus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GithubLogo } from "../auth/GithubLogo";
import { SlideUpTransition } from "../transitions/SlideUpTransition";
import { Input } from "../ui/input";
import { DialogHeaderGradients } from "./DialogHeaderGradients";
import { LogoTile } from "./LogoTile";

interface AddCollaboratorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgName: string;
    repoName: string;
    onSuccess?: () => void;
}

export function AddCollaboratorModal({ open, onOpenChange, orgName, repoName, onSuccess }: AddCollaboratorModalProps) {
    const [githubUsername, setGithubUsername] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccessState, setShowSuccessState] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!githubUsername.trim()) {
            setError("Please enter a GitHub username");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/add-repo-collaborator", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    orgName,
                    repoName,
                    githubUsername: githubUsername.trim()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to add collaborator");
            }

            setShowSuccessState(true);
        } catch (err) {
            console.error("Error adding collaborator:", err);
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Failed to add collaborator. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isSubmitting) {
            handleSubmit();
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && showSuccessState) {
            onSuccess?.();
        }

        // Reset state when closing
        if (!newOpen) {
            setShowSuccessState(false);
            setGithubUsername("");
            setError(null);
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
                        <Image src="/fern-leaf-green.svg" alt="Fern" width={30} height={30} />
                    </LogoTile>

                    {/* Arrow */}
                    <UserPlus className="text-muted-foreground h-5 w-5" />

                    {/* GitHub logo */}
                    <LogoTile className="text-muted-foreground">
                        <GithubLogo width={28} height={28} variant="circle" />
                    </LogoTile>
                </div>
                <div className="flex items-center justify-center h-full w-full bg-background z-1 border-border border-t py-6 px-4 md:px-10">
                    <AnimatePresence mode="wait">
                        {showSuccessState ? (
                            <SlideUpTransition>
                                <div className="relative z-10 pt-4 pb-6 flex flex-col items-center justify-center gap-3">
                                    <h2 className="text-2xl font-semibold">Invitation sent!</h2>

                                    <Button
                                        onClick={() =>
                                            window.open(
                                                `https://github.com/fern-support/${repoName}`,
                                                "_blank",
                                                "noopener,noreferrer"
                                            )
                                        }
                                    >
                                        <GithubLogo width={16} height={16} variant="circle" />
                                        <span>Accept invitation on GitHub</span>
                                    </Button>
                                    <p className="text-xs text-muted-foreground italic">
                                        requires you are signed into GitHub
                                    </p>

                                    <div className="flex items-center gap-3 w-full max-w-[300px] my-2">
                                        <div className="flex-1 h-px bg-border" />
                                        <span className="text-xs text-muted-foreground">OR</span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>

                                    <p className="text-muted-foreground max-w-[350px] text-center text-sm">
                                        Check the email associated with <strong>{githubUsername}</strong> on GitHub to
                                        accept the invitation.
                                    </p>
                                </div>
                            </SlideUpTransition>
                        ) : (
                            <div className="flex flex-col w-full">
                                <DialogHeader className="relative z-10">
                                    <DialogTitle className="text-center text-lg">
                                        Add yourself as a collaborator to <code>{repoName}</code>
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground mx-auto text-center text-sm">
                                        This will let you push changes and manage your docs repository.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="relative z-10 pt-6 pb-3">
                                    <div className="flex flex-col gap-1">
                                        <label
                                            htmlFor="githubUsername"
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            GitHub username
                                        </label>
                                        <div className="flex gap-3">
                                            <Input
                                                id="githubUsername"
                                                placeholder="your-github-username"
                                                type="text"
                                                value={githubUsername}
                                                onChange={(e) => setGithubUsername(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                disabled={isSubmitting}
                                                autoFocus
                                            />
                                            <Button
                                                onClick={handleSubmit}
                                                disabled={isSubmitting || !githubUsername.trim()}
                                            >
                                                <span className="flex items-center text-sm">
                                                    {isSubmitting ? "Sending..." : "Send invite"}
                                                </span>
                                                {isSubmitting ? (
                                                    <Loader2Icon className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <SendIcon className="size-4" />
                                                )}
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
