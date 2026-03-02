"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ReactQueryKey } from "@/state/queryKeys";
import { useOrganizations } from "@/state/useOrganizations";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Note } from "../ui/Note";

export declare namespace DeleteOrganizationModal {
    export interface Props {
        open: boolean;
        onOpenChange: (open: boolean) => void;
        organizationName: string;
        accessToken: string;
    }
}

interface NoteContentProps {
    organizationName: string;
}
/**
 * Component that renders the warning message body for the delete organization confirmation modal.
 */
const NoteContent = ({ organizationName }: NoteContentProps): JSX.Element => (
    <div>
        <p>
            This will delete the <span className="font-semibold">{organizationName}</span> organization and all of it’s
            associated data.
        </p>
        <p className="mt-2 text-destructive">This action is not reversible.</p>
    </div>
);

export function DeleteOrganizationModal({
    open,
    onOpenChange,
    organizationName,
    accessToken
}: DeleteOrganizationModal.Props) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const organizations = useOrganizations();
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
            const response = await fetch("/api/organization/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    organizationId: organizationName
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete organization");
            }

            // Invalidate organizations cache to update the dropdown
            await queryClient.invalidateQueries({ queryKey: ReactQueryKey.myOrganizations() });

            // Find another organization to redirect to
            const remainingOrgs =
                organizations.type === "loaded"
                    ? organizations.value.filter((org) => org.name !== organizationName)
                    : [];

            // Close modal and redirect
            onOpenChange(false);
            setConfirmationText("");

            // Redirect to another org if available, otherwise go to home
            if (remainingOrgs?.[0]) {
                router.push(`/${remainingOrgs[0].name}/docs`);
            } else {
                router.push("/");
            }
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
                    <DialogTitle>Do you want to delete your organization?</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="text-gray-1100 text-sm">
                                <Note variant="error">
                                    <NoteContent organizationName={organizationName} />
                                </Note>
                            </div>
                            <label htmlFor="confirmation" className="text-sm text-gray-1100 mt-6 block">
                                Type <span className="text-destructive">{organizationName}</span> to confirm
                            </label>
                            <Input
                                id="confirmation"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder={organizationName}
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
                        Delete Org
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
