"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteDocsSite } from "@/app/actions/deleteDocsSite";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";

export declare namespace DeleteDocsSiteModal {
    export interface Props {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        docsUrl: DocsUrl;
        orgName: Auth0OrgName;
    }
}

export function DeleteDocsSiteModal({ open, onOpenChange, docsUrl, orgName }: DeleteDocsSiteModal.Props) {
    const router = useRouter();
    const [confirmationText, setConfirmationText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isDeleteEnabled = confirmationText === "DELETE";

    const handleDelete = async () => {
        if (!isDeleteEnabled) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await deleteDocsSite({ url: docsUrl, orgName });

            // Close modal and redirect
            onOpenChange(false);
            setConfirmationText("");

            router.push(`/${orgName}/docs`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            setIsLoading(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!isLoading) {
            onOpenChange(newOpen);
            if (!newOpen) {
                setConfirmationText("");
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Do you want to delete this docs site?</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-gray-1100 text-sm">
                                Type <span className="text-destructive">DELETE</span> to confirm
                            </div>
                            <Input
                                id="confirmation"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder="DELETE"
                                className="font-mono"
                                disabled={isLoading}
                            />
                        </div>

                        {error && (
                            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                                <p>{error}</p>
                            </div>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={!isDeleteEnabled || isLoading}
                        loading={isLoading}
                    >
                        Delete Site
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
