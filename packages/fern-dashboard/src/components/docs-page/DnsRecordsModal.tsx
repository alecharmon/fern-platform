"use client";

import { CheckCircleIcon, CopyIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import type { VercelDnsRecord } from "@/app/services/domain";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";

interface DnsRecordsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    domain: string;
    dnsRecords: VercelDnsRecord[];
    loading: boolean;
    onRefresh: () => void;
}

export function DnsRecordsModal({ open, onOpenChange, domain, dnsRecords, loading, onRefresh }: DnsRecordsModalProps) {
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="mx-auto w-[calc(100%-2rem)] sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Configure DNS for {domain}</DialogTitle>
                </DialogHeader>

                <DialogBody>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Add the following DNS records to your DNS provider to complete the setup:
                        </p>

                        {loading ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                                <Loader2Icon className="size-4 animate-spin" />
                                Loading DNS configuration...
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-md border border-border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                                            <th className="px-4 py-2 font-medium">Type</th>
                                            <th className="px-4 py-2 font-medium">Name</th>
                                            <th className="px-4 py-2 font-medium">Value</th>
                                            <th className="px-4 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dnsRecords.map((record, index) => (
                                            <tr
                                                key={`${record.type}-${record.name}-${index}`}
                                                className="border-b border-border/50 last:border-0"
                                            >
                                                <td className="px-4 py-3 font-mono text-xs">{record.type}</td>
                                                <td className="px-4 py-3 font-mono text-xs">{record.name}</td>
                                                <td className="px-4 py-3 font-mono text-xs break-all max-w-[300px]">
                                                    {record.value}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(record.value, `record-${index}`)}
                                                        className="text-muted-foreground h-7 w-7 p-0"
                                                    >
                                                        {copiedField === `record-${index}` ? (
                                                            <CheckCircleIcon className="size-3.5 text-green-500" />
                                                        ) : (
                                                            <CopyIcon className="size-3.5" />
                                                        )}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                            DNS changes may take up to 48 hours to propagate, but usually happen within a few minutes.
                        </p>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button variant="outline" onClick={onRefresh} disabled={loading}>
                        <RefreshCwIcon className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />
                        Check DNS Status
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
