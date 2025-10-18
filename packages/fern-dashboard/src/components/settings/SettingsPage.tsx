"use client";

import { useState } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { Button } from "../ui/button";
import { DeleteOrganizationModal } from "./DeleteOrganizationModal";

export declare namespace SettingsPage {
    export interface Props {
        session: Auth0SessionData;
    }
}

export function SettingsPage({ session }: SettingsPage.Props) {
    const org = useCurrentOrganization();
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    if (!org) {
        return null;
    }

    return (
        <>
            <div className="flex flex-1 flex-col items-center gap-4">
                <h1 className="mx-auto mt-6 w-full max-w-[750px] text-2xl font-bold sm:mt-8 md:mt-10">Team Settings</h1>
                <div className="border-border mx-auto flex w-full max-w-[750px] flex-col rounded-xl border bg-gray-100 p-4">
                    <div className="flex flex-col gap-1">
                        <div className="font-bold">Delete organization</div>
                        <div className="text-gray-900">This is a destructive action and cannot be reversed.</div>
                    </div>
                    <div className="mt-5 flex justify-center md:justify-end">
                        <Button variant="destructive" onClick={() => setShowDeleteModal(true)}>
                            Delete
                        </Button>
                    </div>
                </div>
            </div>

            <DeleteOrganizationModal
                open={showDeleteModal}
                onOpenChange={setShowDeleteModal}
                organizationName={org.name}
                accessToken={session.accessToken}
            />
        </>
    );
}
