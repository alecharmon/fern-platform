"use client";

import type { DocsDeploymentStatus } from "@fern-api/fdr-sdk/orpc-client";
import { Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getDocsSiteStatus, setDocsSiteStatus } from "@/app/actions/setDocsSiteStatus";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { DocsUrl } from "@/utils/types";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";

interface UnpublishSiteSettingsCardProps {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
}

type CardState = { status: "loading" } | { status: "live" } | { status: "unpublished" } | { status: "error" };

export function UnpublishSiteSettingsCard({ docsUrl, orgName }: UnpublishSiteSettingsCardProps) {
    const [cardState, setCardState] = useState<CardState>({ status: "loading" });
    const [isUpdating, setIsUpdating] = useState(false);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

    // Extract the domain from the docsUrl (e.g. "example.docs.buildwithfern.com/docs" -> domain="example.docs.buildwithfern.com", basepath="/docs")
    const domain = docsUrl.includes("/") ? docsUrl.split("/")[0]! : docsUrl;
    const basepath = docsUrl.includes("/") ? "/" + docsUrl.split("/").slice(1).join("/") : undefined;

    const fetchStatus = useCallback(async () => {
        try {
            const status = await getDocsSiteStatus({ domain, orgName, basepath });
            if (status === "UNPUBLISHED") {
                setCardState({ status: "unpublished" });
            } else if (status === "LIVE" || status === "PUBLISHING") {
                setCardState({ status: "live" });
            } else {
                // null means site predates the deployment tracking system — treat as live
                console.debug(
                    `[UnpublishSiteSettingsCard] No deployment status found for ${domain}, treating as live (site predates deployment tracking)`
                );
                setCardState({ status: "live" });
            }
        } catch {
            setCardState({ status: "error" });
        }
    }, [domain, orgName, basepath]);

    useEffect(() => {
        void fetchStatus();
    }, [fetchStatus]);

    const isCurrentlyUnpublished = cardState.status === "unpublished";

    const handleConfirm = async () => {
        setConfirmDialogOpen(false);
        setIsUpdating(true);
        const newStatus: DocsDeploymentStatus = isCurrentlyUnpublished ? "LIVE" : "UNPUBLISHED";
        try {
            await setDocsSiteStatus({
                domain,
                orgName,
                basepath,
                status: newStatus
            });
            setCardState({ status: newStatus === "UNPUBLISHED" ? "unpublished" : "live" });
            toast.success(newStatus === "UNPUBLISHED" ? "Site unpublished" : "Site republished");
        } catch {
            toast.error(newStatus === "UNPUBLISHED" ? "Failed to unpublish site" : "Failed to republish site");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <>
            <div className="border-border mx-auto flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4">
                <div className="flex flex-col gap-1">
                    <div className="font-bold">{isCurrentlyUnpublished ? "Publish site" : "Unpublish site"}</div>
                    <div className="text-muted-foreground">
                        {isCurrentlyUnpublished
                            ? "This will make your site available at all public URLs specified. You can unpublish it at any time."
                            : "This will remove your site from all URLs and make it inaccessible to visitors. You can republish it at any time."}
                    </div>
                </div>
                <div className="mt-5 flex justify-center md:justify-end">
                    {cardState.status === "loading" ? (
                        <Skeleton className="w-24 h-9" />
                    ) : cardState.status === "error" ? (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCardState({ status: "loading" });
                                void fetchStatus();
                            }}
                            className="w-28"
                        >
                            Retry
                        </Button>
                    ) : (
                        <Button
                            variant={isCurrentlyUnpublished ? "outline" : "destructiveOutline"}
                            onClick={() => setConfirmDialogOpen(true)}
                            disabled={isUpdating}
                            className="w-28 gap-2"
                        >
                            {isUpdating ? <Loader2Icon className="size-4 animate-spin" /> : null}
                            {isCurrentlyUnpublished ? "Publish" : "Unpublish site"}
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {isCurrentlyUnpublished
                                ? "Are you sure you want to publish this site?"
                                : "Are you sure you want to unpublish this site?"}
                        </DialogTitle>
                        <DialogDescription className="pb-4">
                            {isCurrentlyUnpublished
                                ? "This will make your site available at all public URLs specified. You can unpublish it at any time."
                                : "This will remove your site from all URLs and make it inaccessible to visitors. You can republish it at any time."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant={isCurrentlyUnpublished ? "default" : "destructive"}
                            onClick={() => {
                                void handleConfirm();
                            }}
                            disabled={isUpdating}
                            className="gap-2"
                        >
                            {isUpdating ? <Loader2Icon className="size-4 animate-spin" /> : null}
                            {isCurrentlyUnpublished ? "Yes, publish" : "Yes, unpublish"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
