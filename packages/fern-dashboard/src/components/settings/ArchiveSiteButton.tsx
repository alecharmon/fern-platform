"use client";

import { useRouter } from "@bprogress/next/app";
import { useState } from "react";
import { toast } from "sonner";

import { archiveSite } from "@/app/actions/archiveSite";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { delay } from "@/utils/delay";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";

export declare namespace ArchiveSiteButton {
    export interface Props {
        docsUrl: DocsUrl;
        orgName: Auth0OrgName;
    }
}

export function ArchiveSiteButton({ docsUrl, orgName }: ArchiveSiteButton.Props) {
    const [isArchiving, setIsArchiving] = useState(false);
    const router = useRouter();

    const archive = async () => {
        setIsArchiving(true);
        try {
            await Promise.all([
                archiveSite({ url: docsUrl, orgName }),
                // so the loading state shows for at least a second
                delay(1_000)
            ]);
            toast.success(<div className="truncate">Archived {docsUrl}</div>);
            router.push(`/${orgName}/docs`);
        } catch (e) {
            console.error(`Failed to archive ${docsUrl}`, e);
            toast.error("Failed to archive site");
            setIsArchiving(false);
        }
    };

    return (
        <Button
            variant="destructive"
            onClick={() => {
                void archive();
            }}
            loading={isArchiving}
            className="w-24"
        >
            Archive site
        </Button>
    );
}
