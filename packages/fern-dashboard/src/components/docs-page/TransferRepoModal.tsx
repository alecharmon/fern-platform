"use client";

import { ArrowLeftRight, GithubIcon, Loader2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
            setError(err instanceof Error ? err.message : "Failed to transfer repository");
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
            <DialogContent className="max-h-fit !min-h-[375px] overflow-hidden sm:max-w-[500px]">
                {/* Radial gradient background */}
                <div className="bg-gradient-radial pointer-events-none absolute inset-0 from-white via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black" />

                {/* Blurred green blob */}
                <svg
                    className="pointer-events-none absolute"
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
                    <g opacity="0.08" filter="url(#filter0_f_transfer)">
                        <path
                            d="M868.091 327.535C868.091 197.373 743.23 103.591 618.223 139.862L197.919 261.816C194.374 262.844 190.725 263.545 187.052 263.907C114.405 271.059 113.248 377.519 186.014 383.336C190.385 383.685 194.705 384.514 198.896 385.808L615.044 514.256C740.74 553.054 868.091 459.083 868.091 327.535Z"
                            fill="#51C233"
                        />
                    </g>
                    <defs>
                        <filter
                            id="filter0_f_transfer"
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
                    <div className="flex size-16 items-center justify-center rounded-xl bg-white shadow-[0_4px_20px_rgba(30,46,90,0.1)] dark:bg-gray-800">
                        <Image src="/fern-leaf-green.svg" alt="Fern" width={32} height={32} />
                    </div>

                    {/* Arrow */}
                    <ArrowLeftRight className="text-muted-foreground h-5 w-5" />

                    {/* GitHub logo */}
                    <div className="text-foreground flex size-16 items-center justify-center rounded-xl bg-white shadow-[0_4px_20px_rgba(30,46,90,0.1)] dark:bg-gray-800">
                        <GithubIcon className="h-8 w-8" />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {showSuccessState ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="relative z-10 flex flex-col items-center justify-center space-y-4 px-6 py-12"
                        >
                            <h2 className="text-2xl font-semibold">Transfer initiated</h2>
                            <p className="text-muted-foreground max-w-[350px] text-center text-sm">
                                Please check the email tied to your GitHub account to accept the repository transfer.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <DialogHeader className="border-border relative z-10 border-t py-6">
                                <DialogTitle className="text-center text-lg">
                                    Transfer ownership of {repoName} on GitHub
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground mx-auto max-w-[300px] text-center text-sm">
                                    This will allow you to edit your docs site and add additional team members.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="relative z-10 space-y-4 px-6 py-4">
                                <div className="flex flex-col gap-2 pb-6">
                                    <label htmlFor="newOwner" className="text-sm font-medium">
                                        New Owner
                                    </label>
                                    <div className="flex gap-3">
                                        <input
                                            id="newOwner"
                                            type="text"
                                            placeholder="github-username"
                                            value={newOwner}
                                            onChange={(e) => setNewOwner(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            disabled={isTransferring}
                                            autoFocus
                                            className="border-border bg-background placeholder:text-muted-foreground focus:ring-ring flex h-10 w-[75%] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                        <Button
                                            type="button"
                                            className="flex h-full min-h-10 w-fit items-center gap-2 !px-6"
                                            onClick={handleTransfer}
                                            disabled={isTransferring || !newOwner.trim()}
                                        >
                                            {isTransferring ? (
                                                <Loader2Icon className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <GithubIcon className="h-3.5 w-3.5" />
                                            )}
                                            <span className="flex items-center text-sm">
                                                {isTransferring ? "Transferring..." : "Transfer repo"}
                                            </span>
                                        </Button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* <DialogFooter className="relative z-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isTransferring}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleTransfer}
            disabled={isTransferring || !newOwner.trim()}
          >
            {isTransferring ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer Repository"
            )}
          </Button>
        </DialogFooter> */}
            </DialogContent>
        </Dialog>
    );
}
