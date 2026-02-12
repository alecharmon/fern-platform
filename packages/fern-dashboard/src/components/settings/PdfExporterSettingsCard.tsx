"use client";

import { useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import PdfExporterPage from "@/components/pdf-exporter/PdfExporterPage";
import { PdfExportTasksProvider, usePdfExportTasks } from "@/components/pdf-exporter/PdfExportTasksContext";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { DocsUrl } from "@/utils/types";

interface PdfExporterSettingsCardProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    defaultCoverTitle: string;
}

export function PdfExporterSettingsCard(props: PdfExporterSettingsCardProps) {
    const { docsUrl, orgName, defaultCoverTitle } = props;
    return (
        <PdfExportTasksProvider docsUrl={docsUrl} orgName={orgName}>
            <PdfExporterSettingsCardInner docsUrl={docsUrl} orgName={orgName} defaultCoverTitle={defaultCoverTitle} />
        </PdfExportTasksProvider>
    );
}

function PdfExporterSettingsCardInner({ docsUrl, orgName, defaultCoverTitle }: PdfExporterSettingsCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightExports, setHighlightExports] = useState(false);

    const tasksState = usePdfExportTasks();

    const handleOpenViewExports = () => {
        setHighlightExports(true);
        setIsOpen(true);
    };

    const handleOpenLaunch = () => {
        setHighlightExports(false);
        setIsOpen(true);
    };

    const handleClose = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // Reset highlight when dialog closes
            setHighlightExports(false);
        }
    };

    return (
        <>
            <SettingsCard
                title="PDF Exporter"
                description="Export your complete documentation as a PDF to share with customers."
                button={
                    <div className="flex items-center justify-end gap-4">
                        {tasksState.status === "success" && tasksState.tasks.length > 0 && (
                            <Button
                                asChild
                                variant="linkUnderlined"
                                size="sm"
                                className="h-fit px-0! py-0! text-muted-foreground"
                            >
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleOpenViewExports();
                                    }}
                                >
                                    {`View ${tasksState.tasks.length} export${tasksState.tasks.length === 1 ? "" : "s"}`}
                                </a>
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleOpenLaunch}>
                            Launch
                        </Button>
                    </div>
                }
            />

            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="bottom-auto! left-1/2! top-1/2! h-[90vh] w-[95vw] max-w-[1200px]! translate-x-[-50%]! translate-y-[-50%]! overflow-y-auto rounded-xl p-8">
                    <PdfExporterPage
                        docsUrl={docsUrl}
                        orgName={orgName}
                        defaultCoverTitle={defaultCoverTitle}
                        highlightExports={highlightExports}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
