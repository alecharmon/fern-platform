"use client";

import { useRouter } from "next/navigation";
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
import { CreateOrganizationForm } from "./CreateOrganizationForm";

interface CreateOrganizationModalProps {
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationModal({ accessToken, open, onOpenChange }: CreateOrganizationModalProps) {
    const router = useRouter();

    const handleSuccess = (organizationId: string) => {
        onOpenChange(false);
        router.push(`/${organizationId}/docs`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Organization</DialogTitle>
                    <DialogDescription>Setup a new organization to manage SDKs and Docs.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <CreateOrganizationForm
                        accessToken={accessToken}
                        onSuccess={handleSuccess}
                        submitButtonClassName=""
                    />
                </DialogBody>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
