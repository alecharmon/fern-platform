"use client";

import { Button } from "../ui/button";
import { CopyableText } from "../ui/CopyableText";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface ProxyConfigModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    domain: string;
    domainHostOnly: string;
}

export function ProxyConfigModal({ open, onOpenChange, domain, domainHostOnly }: ProxyConfigModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Reverse Proxy Configuration</DialogTitle>
                </DialogHeader>

                <DialogBody>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Configure a reverse proxy on your server to forward requests from{" "}
                            <code className="rounded bg-muted px-1">{domain}</code> to Fern.
                        </p>

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Proxy target</p>
                                <CopyableText text="https://app.buildwithfern.com" successMessage="Copied!" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Required header</p>
                                <CopyableText text={`X-Fern-Host: ${domainHostOnly}`} successMessage="Copied!" />
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Forward all requests from <code className="rounded bg-muted px-1">{domain}</code> to the
                            proxy target with the header above.
                        </p>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
