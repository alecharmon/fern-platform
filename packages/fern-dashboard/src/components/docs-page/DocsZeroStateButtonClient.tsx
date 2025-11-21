"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { Button } from "../ui/button";

interface DocsZeroStateButtonClientProps {
    orgName: Auth0OrgName | undefined;
    /**
     * If true, links to internal wizard (/org/docs/new)
     * If false, links to external documentation
     */
    useInternalWizard: boolean;
}

export function DocsZeroStateButtonClient({ useInternalWizard }: DocsZeroStateButtonClientProps) {
    const orgName = useOrgNameFromPathname();

    const href = useInternalWizard
        ? `/${orgName}/docs/new`
        : "https://buildwithfern.com/learn/docs/getting-started/quickstart";

    const target = useInternalWizard ? undefined : "_blank";

    return (
        <Button variant={orgName ? "default" : "secondary"} asChild>
            <Link href={href} target={target} className="flex items-center gap-2" rel="noopener">
                <PlusIcon className="h-4 w-4" />
                Create your first docs site
            </Link>
        </Button>
    );
}
