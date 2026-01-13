import { GlobeIcon, PencilIcon } from "lucide-react";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { GoToEditorButton } from "@/components/docs-page/GoToEditorButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { DocsUrl } from "@/utils/types";

export default async function DocsHeader({ params }: Readonly<{ params: Promise<{ docsUrl: DocsUrl }> }>) {
    const { docsUrl: encodedDocsUrl } = await params;
    const session = (await getCurrentSession())!;
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });
    return (
        <PageHeader
            title={<span className="break-all">{docsUrl}</span>}
            titleRightContent={<StatusBadge status="live" />}
            farRightContent={
                docsUrl && (
                    <div className="flex items-center gap-2">
                        <GoToEditorButton
                            docsUrl={docsUrl}
                            session={session}
                            disabled={false}
                            variant="outline"
                            size="icon"
                            content={<PencilIcon className="size-4" />}
                            isValidatingSource={false}
                        />
                        <Button variant="outline" asChild>
                            <a
                                href={new URL(`https://${docsUrl}`).toString()}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span className="sr-only">{docsUrl}</span>
                                <GlobeIcon className="h-4 w-4" />
                                Visit
                            </a>
                        </Button>
                    </div>
                )
            }
        />
    );
}
