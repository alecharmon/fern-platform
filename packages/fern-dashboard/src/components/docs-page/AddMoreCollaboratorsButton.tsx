"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { docsPermissionScope } from "../auth/authz";
import { AuthZButton } from "../auth/authz/AuthZButton";
import { AddCollaboratorModal } from "../shared/AddCollaboratorModal";

interface AddMoreCollaboratorsButtonProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    sourceRepoName: string;
}

export function AddMoreCollaboratorsButton({ docsUrl, orgName, sourceRepoName }: AddMoreCollaboratorsButtonProps) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <AuthZButton
                permission="manage-settings"
                permissionScope={docsPermissionScope(docsUrl)}
                variant="ghost"
                size="xs"
                onClick={() => setShowModal(true)}
                className="text-green-1100 hover:bg-green-200 hover:text-green-1100 w-fit -ml-1"
            >
                <UserPlus className="size-3.5" />
                Add more collaborators
            </AuthZButton>
            <AddCollaboratorModal
                open={showModal}
                onOpenChange={setShowModal}
                repoName={sourceRepoName}
                docsUrl={docsUrl}
                orgName={orgName}
            />
        </>
    );
}
