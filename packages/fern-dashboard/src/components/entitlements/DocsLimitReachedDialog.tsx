"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

interface DocsLimitReachedDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgName: Auth0OrgName;
}

export function DocsLimitReachedDialog({ open, onOpenChange, orgName }: DocsLimitReachedDialogProps) {
    const posthog = usePostHog();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Docs site limit reached</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <p className="text-sm text-text-description">
                        Your current plan has reached its docs site limit. Upgrade to create additional docs sites.
                    </p>
                    <Button asChild className="group mt-2 w-full">
                        <Link
                            href={`/${orgName}/billing?reason=docs_site_limit`}
                            onClick={() => {
                                captureEvent(posthog, PosthogEventName.UPGRADE_CTA_CLICKED, {
                                    source: "docs_limit_dialog"
                                });
                                onOpenChange(false);
                            }}
                        >
                            Upgrade plan
                            <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] group-hover:translate-x-0.5" />
                        </Link>
                    </Button>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}
