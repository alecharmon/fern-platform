"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Auth0OrgID, Auth0OrgName } from "@/app/services/auth0/types";
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
import orgRedirect from "@/utils/orgRedirect";

interface CreateOrganizationModalProps {
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationModal({ accessToken, open, onOpenChange }: CreateOrganizationModalProps) {
    const router = useRouter();
    const [organizationName, setOrganizationName] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch("/api/organization/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    organizationId: organizationName,
                    displayName: displayName || undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create organization");
            }

            const data = await response.json();
            onOpenChange(false);
            setIsLoading(false);
            // Use orgRedirect to properly authenticate with the new organization
            router.push(
                orgRedirect({
                    id: data.orgId as Auth0OrgID,
                    name: data.organizationId as Auth0OrgName
                })
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
            setIsLoading(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        if (!isLoading) {
            onOpenChange(newOpen);
            if (!newOpen) {
                setOrganizationName("");
                setDisplayName("");
                setError(null);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>Setup a new organization to manage SDKs and Docs.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <DialogBody>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="text-gray-1100 text-sm">
                                    Organization ID <span className="text-destructive">*</span>
                                </div>
                                <Input
                                    id="organizationName"
                                    type="text"
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    placeholder="my-organization"
                                    required
                                    disabled={isLoading}
                                />
                                <p className="text-muted-foreground text-xs">
                                    This will be used in URLs and cannot be changed later. Use lowercase letters,
                                    numbers, and hyphens.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="text-gray-1100 text-sm">Display Name</div>
                                <Input
                                    id="displayName"
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="My Organization"
                                    disabled={isLoading}
                                />
                                <p className="text-muted-foreground text-xs">
                                    Optional: A friendly name for your organization
                                </p>
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
                        <Button type="submit" disabled={isLoading || !organizationName} loading={isLoading}>
                            Create Organization
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
