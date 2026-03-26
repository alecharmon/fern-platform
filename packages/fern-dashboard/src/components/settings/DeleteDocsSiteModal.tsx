"use client";

import { useState } from "react";

import { deleteDocsSite } from "@/app/actions/deleteDocsSite";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Note } from "../ui/Note";

interface DeleteDocsSiteModalProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DeleteDocsSiteModal({ docsUrl, orgName, open, onOpenChange }: DeleteDocsSiteModalProps) {
    const [confirmationText, setConfirmationText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isDeleteEnabled = confirmationText === docsUrl;

    const handleDelete = async () => {
        if (!isDeleteEnabled) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await deleteDocsSite({ url: docsUrl, orgName });
            // Force a full page reload to bypass the client-side router cache
            // so the docs list page fetches fresh data and redirects to the next available site
            window.location.href = `/${orgName}/docs`;
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
                setError(null);
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
                                <Note variant="error">
                                    <div>
                                        <p>
                                            {"This will delete the "}
                                            <span className="font-semibold">{docsUrl}</span>
                                            {" site and all of its associated data."}
                                        </p>
                                        <p className="mt-2 text-destructive">{"This action is not reversible."}</p>
                                    </div>
                                </Note>
                            </div>
                            <label htmlFor="confirm-delete-input" className="text-sm text-gray-1100 mt-6 block">
                                {"Type "}
                                <span className="text-destructive">{docsUrl}</span>
                                {" to confirm"}
                            </label>
                            <Input
                                id="confirm-delete-input"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder={docsUrl}
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
                        Delete site
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
