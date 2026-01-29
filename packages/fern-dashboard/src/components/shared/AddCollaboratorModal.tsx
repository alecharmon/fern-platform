"use client";

import { Loader2Icon, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GithubLogo } from "../auth/GithubLogo";
import { Input } from "../ui/input";

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
                {/* Radial gradient background */}
                <div className="z-0 bg-gradient-radial pointer-events-none absolute inset-0 from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black" />

                {/* Blurred green blob */}
                <svg
                    className="pointer-events-none absolute z-0"
                    style={{
                        width: "600px",
                        height: "300px",
                        left: "-100px",
                        top: "-50px"
                    }}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1001 656"
                    fill="none"
                >
                    <g opacity="0.08" filter="url(#filter0_f_collaborator)">
                        <path
                            d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                            fill="#51C233"
                        />
                    </g>
                    <defs>
                        <filter
                            id="filter0_f_collaborator"
                            x="0"
                            y="0"
                            width="1000.09"
                            height="655.083"
                            filterUnits="userSpaceOnUse"
                            colorInterpolationFilters="sRGB"
                        >
                            <feFlood floodOpacity="0" result="BackgroundImageFix" />
                            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                            <feGaussianBlur stdDeviation="66" result="effect1_foregroundBlur" />
                        </filter>
                    </defs>
                </svg>

                {/* Icon flow visualization */}
                <div className="relative z-10 flex items-center justify-center gap-4 py-6">
                    {/* Fern logo */}
                    <div className="border border-border flex size-16 items-center justify-center rounded-xl bg-white shadow-[0_4px_20px_rgba(30,46,90,0.1)] dark:bg-gray-800">
                        <Image src="/fern-leaf-green.svg" alt="Fern" width={24} height={24} />
                    </div>

                    {/* Arrow */}
                    <UserPlus className="text-muted-foreground h-5 w-5" />

                    {/* GitHub logo */}
                    <div className="border border-border text-muted-foreground flex size-16 items-center justify-center rounded-xl bg-white shadow-[0_4px_20px_rgba(30,46,90,0.1)] dark:bg-gray-800">
                        <GithubLogo width={20} height={20} />
                    </div>
                </div>
                <div className="flex items-center justify-center h-full w-full bg-white dark:bg-gray-800 z-1 border-border border-t py-6 px-10">
                    <AnimatePresence mode="wait">
                        {showSuccessState ? (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="relative z-10 pt-4 pb-6 flex flex-col items-center justify-center gap-3"
                            >
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
                                    <GithubLogo width={16} height={16} />
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
                            </motion.div>
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
                                            GitHub Username
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
                                                {isSubmitting ? (
                                                    <Loader2Icon className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <GithubLogo width={16} height={16} />
                                                )}
                                                <span className="flex items-center text-sm">
                                                    {isSubmitting ? "Sending..." : "Send invite"}
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
