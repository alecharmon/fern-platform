"use client";

import { GlobeIcon } from "lucide-react";
import { useParams } from "next/navigation";

import NotFoundContent from "@/components/docs-page/NotFoundContent";

export default function DocsNotFound() {
    const { docsUrl } = useParams();
    return (
        <NotFoundContent hideFooter icon={GlobeIcon}>
            Site <code>{docsUrl}</code> was not found. Please make sure this site exists and has not been archived.
        </NotFoundContent>
    );
}
