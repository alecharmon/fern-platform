"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

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
    const [error, setError] = useState<string | null>(null);

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

            // Success!
            onSuccess(result.newRepoUrl);
            onOpenChange(false);

            // Reset form
            setNewOwner("");
            setError(null);
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Transfer ownership of repository</DialogTitle>
                    <DialogDescription>
                        Transfer <span className="font-mono text-sm">{repoName}</span> to your own GitHub user or
                        organization.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-6 py-4">
                    <div className="space-y-2">
                        <label htmlFor="newOwner" className="text-sm font-medium">
                            New Owner
                        </label>
                        <input
                            id="newOwner"
                            type="text"
                            placeholder="github-username"
                            value={newOwner}
                            onChange={(e) => setNewOwner(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isTransferring}
                            autoFocus
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-700">
                            Enter the GitHub username or organization name to transfer this repository to
                        </p>
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        <strong>Note:</strong> The new owner must accept the transfer. You will lose access to this
                        repository once transferred.
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isTransferring}
                    >
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleTransfer} disabled={isTransferring || !newOwner.trim()}>
                        {isTransferring ? (
                            <>
                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                Transferring...
                            </>
                        ) : (
                            "Transfer Repository"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
