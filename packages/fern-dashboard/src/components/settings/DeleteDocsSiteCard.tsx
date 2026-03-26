"use client";

import { useState } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import { DeleteDocsSiteModal } from "./DeleteDocsSiteModal";

interface DeleteDocsSiteCardProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

export function DeleteDocsSiteCard({ docsUrl, orgName }: DeleteDocsSiteCardProps) {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <div className="border-border mx-auto flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4">
                <div className="flex flex-col gap-1">
                    <div className="font-bold">Delete site</div>
                    <div className="text-muted-foreground">This will delete your site and all associated data.</div>
                </div>
                <div className="mt-5 flex justify-center md:justify-end">
                    <Button variant="destructive" onClick={() => setModalOpen(true)}>
                        Delete site
                    </Button>
                </div>
            </div>

            <DeleteDocsSiteModal docsUrl={docsUrl} orgName={orgName} open={modalOpen} onOpenChange={setModalOpen} />
        </>
    );
}
