"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import type { Auth0SessionData } from "@/app/services/auth0/getCurrentSession";
import { useCurrentOrganization } from "@/state/useOrganizations";
import { PageHeader } from "../layout/PageHeader";
import { Button } from "../ui/button";
import { CreateApiKeyModal } from "./CreateApiKeyModal";

export declare namespace ApiKeysPage {
    export interface Props {
        session: Auth0SessionData;
    }
}

export function ApiKeysPage({ session }: ApiKeysPage.Props) {
    const org = useCurrentOrganization();
    const [showCreateModal, setShowCreateModal] = useState(false);

    if (!org) {
        return null;
    }

    return (
        <>
            <div className="mx-auto flex min-w-0 max-w-5xl flex-1 flex-col">
                <PageHeader
                    title="API Keys"
                    subtitle="Use them to interface with the Fern API and CLI."
                    farRightContent={
                        <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
                            <Plus />
                            Create API Key
                        </Button>
                    }
                />
            </div>

            <CreateApiKeyModal open={showCreateModal} onOpenChange={setShowCreateModal} />
        </>
    );
}
