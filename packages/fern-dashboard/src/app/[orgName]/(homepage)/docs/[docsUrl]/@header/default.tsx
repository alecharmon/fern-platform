import { GlobeIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { DocsUrl } from "@/utils/types";

export default async function DocsHeader({ params }: Readonly<{ params: Promise<{ docsUrl: DocsUrl }> }>) {
    const { docsUrl: encodedDocsUrl } = await params;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });
    return (
        <PageHeader
            title={<span className="break-all">{docsUrl}</span>}
            titleRightContent={<StatusBadge status="live" />}
            farRightContent={
                docsUrl && (
                    <Button variant="default" asChild>
                        <a href={new URL(`https://${docsUrl}`).toString()} target="_blank" rel="noopener noreferrer">
                            <span className="sr-only">{docsUrl}</span>
                            <GlobeIcon className="h-4 w-4" />
                            Visit
                        </a>
                    </Button>
                )
            }
        />
    );
}
