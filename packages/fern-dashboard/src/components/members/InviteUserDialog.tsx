import { Plus } from "lucide-react";
import { useState } from "react";

import type { Auth0Organization } from "@/app/services/auth0/types";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogTrigger } from "../ui/dialog";
import { InviteUserDialogContent } from "./InviteUserDialogContent";

export declare namespace InviteUserDialog {
    export interface Props {
        org: Auth0Organization | undefined;
        initialEmail?: string;
        defaultOpen?: boolean;
        isFernAdmin?: boolean;
        isEnforcePermissionsEnabled?: boolean;
    }
}

export function InviteUserDialog({
    org,
    initialEmail,
    defaultOpen,
    isFernAdmin,
    isEnforcePermissionsEnabled
}: InviteUserDialog.Props) {
    const [isOpen, setIsOpen] = useState(defaultOpen ?? false);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="default">
                    <Plus />
                    Add member
                </Button>
            </DialogTrigger>
            <DialogContent
                onEscapeKeyDown={(event) => {
                    event.preventDefault();
                }}
                onInteractOutside={(event) => {
                    event.preventDefault();
                }}
                persistent={true}
            >
                <InviteUserDialogContent
                    org={org}
                    close={() => {
                        setIsOpen(false);
                    }}
                    initialEmail={initialEmail}
                    initialTab={initialEmail ? "email" : "link"}
                    isFernAdmin={isFernAdmin}
                    isEnforcePermissionsEnabled={isEnforcePermissionsEnabled}
                />
            </DialogContent>
        </Dialog>
    );
}
