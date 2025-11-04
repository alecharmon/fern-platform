"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";
import { Button } from "../ui/button";

export function DocsZeroStateButton() {
    const orgName = useOrgNameFromPathname();
    return (
        <Button variant="default" asChild>
            <Link href={`/${orgName}/docs/new`} className="flex items-center gap-2" rel="noopener">
                <PlusIcon className="h-4 w-4" />
                Create your first docs site
            </Link>
        </Button>
    );
}
