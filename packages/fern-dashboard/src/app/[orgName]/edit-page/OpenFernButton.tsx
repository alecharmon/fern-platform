"use client";

import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { openFernEditor } from "@/app/actions/openFernEditor";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";

interface OpenFernButtonProps {
    orgName: Auth0OrgName;
    docsUrl: string;
    slug: string;
}

export function OpenFernButton({ orgName, docsUrl, slug }: OpenFernButtonProps) {
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(async () => {
            await openFernEditor({ orgName, docsUrl, slug });
        });
    };

    return (
        <Button onClick={handleClick} disabled={isPending} className="w-full">
            {isPending ? (
                <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Opening...
                </>
            ) : (
                "Open Fern"
            )}
        </Button>
    );
}
