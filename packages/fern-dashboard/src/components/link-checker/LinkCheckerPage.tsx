"use client";

import { useQuery } from "@tanstack/react-query";
import { GlobeIcon, PlayIcon, SquareIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { getDocsSiteDomains } from "@/app/actions/getDocsSiteDomains";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import LinkCheckerProgress from "./LinkCheckerProgress";
import LinkCheckerResults from "./LinkCheckerResults";
import { useLinkChecker } from "./useLinkChecker";

interface LinkCheckerPageProps {
    docsUrl: string;
    orgName: Auth0OrgName;
}

export default function LinkCheckerPage({ docsUrl, orgName }: LinkCheckerPageProps) {
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [confirmStop, setConfirmStop] = useState(false);
    const linkChecker = useLinkChecker();

    const {
        data: domains,
        isLoading: domainsLoading,
        error: domainsError
    } = useQuery({
        queryKey: ["docs-site-domains", docsUrl, orgName],
        queryFn: () => getDocsSiteDomains(docsUrl, orgName),
        staleTime: 1000 * 60 * 10
    });

    useEffect(() => {
        if (!selectedDomain && domains && domains.length > 0) {
            const primaryDomain = domains.find(
                (d) => !d.domain.includes("staging") && !d.domain.includes(".buildwithfern.com")
            );
            if (primaryDomain) {
                setSelectedDomain(primaryDomain.domain + (primaryDomain.path || ""));
            } else if (domains[0]?.domain) {
                setSelectedDomain(domains[0].domain + (domains[0].path || ""));
            }
        }
    }, [domains, selectedDomain]);

    // Reset confirm state when not running or after timeout
    useEffect(() => {
        if (!linkChecker.isRunning) {
            setConfirmStop(false);
        }
    }, [linkChecker.isRunning]);

    useEffect(() => {
        if (!confirmStop) {
            return;
        }
        const timeout = setTimeout(() => setConfirmStop(false), 3000);
        return () => clearTimeout(timeout);
    }, [confirmStop]);

    const handleStart = () => {
        if (selectedDomain) {
            setConfirmStop(false);
            linkChecker.start(selectedDomain);
        }
    };

    const handleStop = () => {
        if (confirmStop) {
            linkChecker.stop();
            setConfirmStop(false);
        } else {
            setConfirmStop(true);
        }
    };

    const handleReset = () => {
        setConfirmStop(false);
        linkChecker.reset();
    };

    if (domainsLoading) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (domainsError) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                Failed to load domains. Please try again later.
            </div>
        );
    }

    if (!domains || domains.length === 0) {
        return (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                No domains configured for this site.
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold">Link Checker</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Scan your documentation site for broken links. Select a domain and click Start to begin.
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedDomain || ""} onValueChange={setSelectedDomain} disabled={linkChecker.isRunning}>
                    <SelectTrigger className="border-border w-64 gap-2 bg-white px-3 py-1.5 text-sm dark:bg-transparent">
                        <GlobeIcon className="text-muted-foreground size-4" />
                        <SelectValue placeholder="Select a domain" />
                    </SelectTrigger>
                    <SelectContent>
                        {domains.map((domainUrl) => {
                            const fullDomain = domainUrl.domain + (domainUrl.path || "");
                            return (
                                <SelectItem key={fullDomain} value={fullDomain}>
                                    {fullDomain}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>

                {linkChecker.status === "idle" && (
                    <Button onClick={handleStart} disabled={!selectedDomain} className="gap-2">
                        <PlayIcon className="h-4 w-4" />
                        Start Check
                    </Button>
                )}

                {linkChecker.isRunning && (
                    <Button onClick={handleStop} variant={confirmStop ? "destructive" : "outline"} className="gap-2">
                        <SquareIcon className="h-4 w-4" />
                        {confirmStop ? "Click to confirm" : "Stop"}
                    </Button>
                )}

                {(linkChecker.status === "complete" || linkChecker.status === "error") && (
                    <Button onClick={handleReset} variant="outline">
                        Reset
                    </Button>
                )}
            </div>

            {linkChecker.status !== "idle" && linkChecker.status !== "complete" && (
                <LinkCheckerProgress
                    status={linkChecker.status}
                    totalPages={linkChecker.totalPages}
                    pagesScraped={linkChecker.pagesScraped}
                    totalLinks={linkChecker.totalLinks}
                    linksChecked={linkChecker.linksChecked}
                    logs={linkChecker.logs}
                />
            )}

            {linkChecker.status === "error" && linkChecker.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {linkChecker.error}
                </div>
            )}

            {linkChecker.status === "complete" && (
                <LinkCheckerResults
                    totalPages={linkChecker.totalPages}
                    totalLinks={linkChecker.totalLinks}
                    brokenLinks={linkChecker.brokenLinks}
                    blockedLinks={linkChecker.blockedLinks}
                    workingLinks={linkChecker.workingLinks}
                    skippedLinks={linkChecker.skippedLinks}
                    duration={linkChecker.duration}
                />
            )}
        </div>
    );
}
