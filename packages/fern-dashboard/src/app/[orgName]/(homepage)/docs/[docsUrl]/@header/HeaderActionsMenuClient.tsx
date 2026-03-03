"use client";

import { ArrowUpRight, BookDown, Download, EllipsisVertical } from "lucide-react";
import { useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsStructure } from "@/components/pdf-exporter/infer-docs-structure";
import PdfExporterPage from "@/components/pdf-exporter/PdfExporterPage";
import { PdfExportTasksProvider, usePdfExportTasks } from "@/components/pdf-exporter/PdfExportTasksContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { DocsUrl } from "@/utils/types";

type HeaderActionsMenuClientProps = {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    defaultCoverTitle: string;
    docsStructure: DocsStructure;
};

export function HeaderActionsMenuClient({
    docsUrl,
    orgName,
    defaultCoverTitle,
    docsStructure
}: HeaderActionsMenuClientProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [highlightExports, setHighlightExports] = useState(false);

    const handleOpenDialog = (highlight: boolean) => {
        setHighlightExports(highlight);
        setIsDialogOpen(true);
    };

    const handleCloseDialog = (open: boolean) => {
        setIsDialogOpen(open);
        if (!open) {
            setHighlightExports(false);
        }
    };

    return (
        <PdfExportTasksProvider docsUrl={docsUrl} orgName={orgName}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="w-8">
                        <EllipsisVertical className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[170px]">
                    <MenuItems docsUrl={docsUrl} onOpenDialog={handleOpenDialog} />
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
                <DialogContent className="bottom-auto! left-1/2! top-1/2! h-[90vh] w-[95vw] max-w-[1200px]! translate-x-[-50%]! translate-y-[-50%]! overflow-y-auto rounded-xl p-8">
                    <PdfExporterPage
                        docsUrl={docsUrl}
                        orgName={orgName}
                        defaultCoverTitle={defaultCoverTitle}
                        docsStructure={docsStructure}
                        highlightExports={highlightExports}
                    />
                </DialogContent>
            </Dialog>
        </PdfExportTasksProvider>
    );
}

function MenuItems({ docsUrl, onOpenDialog }: { docsUrl: DocsUrl; onOpenDialog: (highlight: boolean) => void }) {
    const tasksState = usePdfExportTasks();

    return (
        <>
            <MenuItem
                icon={<ArrowUpRight className="size-4 text-gray-800" />}
                onClick={() => window.open(new URL(`https://${docsUrl}`).toString(), "_blank")}
            >
                Visit site
            </MenuItem>
            <MenuItem icon={<Download className="size-4 text-gray-800" />} onClick={() => onOpenDialog(false)}>
                Export as PDF
            </MenuItem>
            {tasksState.status === "success" && tasksState.tasks.length > 0 && (
                <MenuItem icon={<BookDown className="size-4 text-gray-800" />} onClick={() => onOpenDialog(true)}>
                    {`View ${tasksState.tasks.length} export${tasksState.tasks.length === 1 ? "" : "s"}`}
                </MenuItem>
            )}
        </>
    );
}

function MenuItem({
    children,
    icon,
    onClick
}: {
    children: React.ReactNode;
    icon: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <DropdownMenuItem className="flex w-full justify-between text-muted-foreground" onClick={onClick}>
            {children}
            <span className="size-4 text-gray-800">{icon}</span>
        </DropdownMenuItem>
    );
}
