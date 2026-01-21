"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { removeCustomDomain } from "@/app/actions/customDomain";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

interface RemoveCustomDomainModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    domain: string;
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

export function RemoveCustomDomainModal({
    open,
    onOpenChange,
    domain,
    docsUrl,
    orgName
}: RemoveCustomDomainModalProps) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canRemove = confirmText === domain;

    const handleRemove = async () => {
        if (!canRemove) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const result = await removeCustomDomain({
                docsUrl,
                orgName,
                domain
            });

            if (!result.success) {
                setError(result.error || "Failed to remove domain.");
                return;
            }

            toast.success(`${domain} has been removed.`);
            onOpenChange(false);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!isLoading) {
            onOpenChange(newOpen);
            if (!newOpen) {
                setConfirmText("");
                setError(null);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Remove Custom Domain</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            This will remove <strong>{domain}</strong> from your documentation site. Your docs will no
                            longer be accessible at this domain.
                        </p>
                        <div className="space-y-2">
                            <p className="text-sm">
                                Type <span className="text-destructive font-mono">{domain}</span> to confirm:
                            </p>
                            <Input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={domain}
                                disabled={isLoading}
                                className="font-mono"
                            />
                        </div>
                        {error && (
                            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRemove}
                        disabled={!canRemove || isLoading}
                        loading={isLoading}
                    >
                        Remove Domain
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
