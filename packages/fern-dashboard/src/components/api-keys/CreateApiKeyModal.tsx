"use client";

import { Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCurrentOrganization } from "@/state/useOrganizations";

interface CreateApiKeyModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateApiKeyModal({ open, onOpenChange }: CreateApiKeyModalProps) {
    const org = useCurrentOrganization();
    const [apiKey, setApiKey] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Generate API key when modal opens
    useEffect(() => {
        if (open && org) {
            handleCreateKey();
        }
    }, [open, org]);

    const handleCreateKey = async () => {
        if (!org) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch("/api/generate-api-token", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    organizationId: org.name
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to generate API key");
            }

            const data = await response.json();
            setApiKey(data.token);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            toast.error("Failed to generate API key");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyToClipboard = async () => {
        await navigator.clipboard.writeText(apiKey);
        toast.success("API key copied to clipboard!");
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state immediately so key can't be seen again
        setApiKey("");
        setError(null);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>API Key</DialogTitle>
                    <DialogDescription>Copy your API key now. You won't be able to see it again.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    {isLoading ? (
                        <div className="space-y-2">
                            <div className="text-gray-1100 text-sm">API Key</div>
                            <div className="bg-muted flex h-10 w-full items-center justify-center rounded-md">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        </div>
                    ) : error ? (
                        <div className="space-y-2">
                            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                                <p>{error}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-gray-1100 text-sm">API Key</div>
                            <div className="relative">
                                <Input value={apiKey} readOnly className="font-mono text-xs pr-12" />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopyToClipboard}
                                    className="absolute right-1 top-1/2 -translate-y-1/2"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogBody>
                <DialogFooter>
                    <Button onClick={handleClose} disabled={isLoading || !apiKey || !!error}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
