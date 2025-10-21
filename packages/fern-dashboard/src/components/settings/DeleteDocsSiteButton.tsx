"use client";

import { useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";
import { Button } from "../ui/button";
import { DeleteDocsSiteModal } from "./DeleteDocsSiteModal";

export declare namespace DeleteDocsSiteButton {
    export interface Props {
        docsUrl: DocsUrl;
        orgName: Auth0OrgName;
    }
}

export function DeleteDocsSiteButton({ docsUrl, orgName }: DeleteDocsSiteButton.Props) {
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    return (
        <>
            <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
                Delete
            </Button>
            <DeleteDocsSiteModal
                open={showDeleteModal}
                onOpenChange={setShowDeleteModal}
                docsUrl={docsUrl}
                orgName={orgName}
            />
        </>
    );
}
