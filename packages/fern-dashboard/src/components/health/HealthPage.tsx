"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlobeIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    type DocsScoreIssue,
    type DocsScoreResponse,
    getDocsScore as fetchDocsScoreAction,
    type IssueSeverity,
    triggerDocsScore as triggerDocsScoreAction
} from "@/app/actions/getDocsScore";
import { getDocsSiteDomains } from "@/app/actions/getDocsSiteDomains";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import IssueSeverityGroup from "./IssueCategory";
import SeveritySummary from "./ScoreGauge";

interface HealthPageProps {
    docsUrl: string;
    orgName: Auth0OrgName;
}

export default function HealthPage({ docsUrl, orgName }: HealthPageProps) {
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const {
        data: domains,
        isLoading: domainsLoading,
        error: domainsError
    } = useQuery({
        queryKey: ["docs-site-domains", docsUrl, orgName],
        queryFn: () => getDocsSiteDomains(docsUrl, orgName),
        staleTime: 1000 * 60 * 10
    });

    const {
        data: scoreData,
        isLoading: scoreLoading,
        error: scoreError
    } = useQuery({
        queryKey: ["docs-score", selectedDomain],
        queryFn: () => (selectedDomain ? fetchDocsScoreAction(selectedDomain, orgName) : null),
        enabled: !!selectedDomain,
        staleTime: 1000 * 60 * 5,
        refetchInterval: (query) => {
            const data = query.state.data as DocsScoreResponse | null | undefined;
            if (data?.isProcessing) {
                return 3000;
            }
            return false;
        }
    });

    const triggerMutation = useMutation({
        mutationFn: (domain: string) => triggerDocsScoreAction(domain, orgName),
        onSuccess: (data) => {
            // Set the query data to the "processing" state returned by triggerDocsScore
            // This ensures isProcessing is true and polling starts immediately
            queryClient.setQueryData(["docs-score", selectedDomain], data);
        }
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

    // Track which domains we've auto-triggered to avoid duplicate triggers
    const autoTriggeredRef = useRef<Set<string>>(new Set());

    // Auto-trigger score calculation on page load when no data exists
    useEffect(() => {
        if (
            selectedDomain &&
            !scoreLoading &&
            scoreData?.data === null &&
            !scoreData?.isProcessing &&
            !triggerMutation.isPending &&
            !autoTriggeredRef.current.has(selectedDomain)
        ) {
            autoTriggeredRef.current.add(selectedDomain);
            triggerMutation.mutate(selectedDomain);
        }
    }, [selectedDomain, scoreLoading, scoreData, triggerMutation]);

    const handleRefresh = () => {
        if (selectedDomain) {
            triggerMutation.mutate(selectedDomain);
        }
    };

    const isProcessing = scoreData?.isProcessing || triggerMutation.isPending;
    const issueCounts = scoreData?.data?.issueCounts ?? null;
    const totalIssues = issueCounts
        ? issueCounts.critical + issueCounts.high + issueCounts.medium + issueCounts.low
        : 0;

    // Group issues by severity for display
    const issuesBySeverity = useMemo(() => {
        const issues = scoreData?.data?.issues ?? [];
        const grouped: Record<IssueSeverity, DocsScoreIssue[]> = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };
        for (const issue of issues) {
            grouped[issue.severity].push(issue);
        }
        return grouped;
    }, [scoreData?.data?.issues]);

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
        <div className="flex min-w-0 flex-1 flex-col items-center">
            <div className="mb-4 flex w-full max-w-[1200px] flex-col rounded-2xl border border-border p-6">
                <div className="mb-6 flex w-full items-center justify-between">
                    <h2 className="text-xl font-semibold">Health</h2>
                    <div className="flex items-center gap-3">
                        <Select value={selectedDomain || ""} onValueChange={setSelectedDomain}>
                            <SelectTrigger className="w-64 gap-2 border-border bg-white px-3 py-1.5 text-sm dark:bg-transparent">
                                <GlobeIcon className="size-4 text-muted-foreground" />
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

                        <Button
                            onClick={handleRefresh}
                            disabled={!selectedDomain || isProcessing}
                            variant="outline"
                            className="gap-2"
                        >
                            <RefreshCwIcon className={`h-4 w-4 ${isProcessing ? "animate-spin" : ""}`} />
                            {scoreData?.data === null && !isProcessing ? "Analyze" : "Refresh"}
                        </Button>
                    </div>
                </div>

                {scoreError && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Failed to load health score. Please try again later.
                    </div>
                )}

                {triggerMutation.error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        Failed to trigger score calculation. Please try again later.
                    </div>
                )}

                {selectedDomain && !scoreError && (
                    <>
                        <div className="mb-8 w-full">
                            {scoreLoading ? (
                                <div className="grid grid-cols-4 gap-4">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : (
                                <SeveritySummary issueCounts={issueCounts} isProcessing={isProcessing} />
                            )}
                        </div>

                        {!scoreLoading && !isProcessing && scoreData?.data && (
                            <div className="w-full">
                                <div className="mb-4 flex items-center justify-between">
                                    <h3 className="text-lg font-medium">Issues</h3>
                                    {scoreData?.updatedAt && (
                                        <span className="text-sm text-muted-foreground">
                                            Last analyzed {new Date(scoreData.updatedAt).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {totalIssues > 0 ? (
                                    <div className="flex flex-col gap-3">
                                        {[
                                            {
                                                severity: "critical" as const,
                                                issues: issuesBySeverity.critical,
                                                defaultExpanded: issuesBySeverity.critical.length > 0
                                            },
                                            {
                                                severity: "high" as const,
                                                issues: issuesBySeverity.high,
                                                defaultExpanded:
                                                    issuesBySeverity.critical.length === 0 &&
                                                    issuesBySeverity.high.length > 0
                                            },
                                            {
                                                severity: "medium" as const,
                                                issues: issuesBySeverity.medium,
                                                defaultExpanded: false
                                            },
                                            {
                                                severity: "low" as const,
                                                issues: issuesBySeverity.low,
                                                defaultExpanded: false
                                            }
                                        ]
                                            .filter((group) => group.issues.length > 0)
                                            .map((group, index) => (
                                                <div
                                                    key={group.severity}
                                                    className="animate-in fade-in slide-in-from-left-2"
                                                    style={{
                                                        animationDelay: `${index * 100}ms`,
                                                        animationFillMode: "backwards",
                                                        animationDuration: "300ms"
                                                    }}
                                                >
                                                    <IssueSeverityGroup
                                                        severity={group.severity}
                                                        issues={group.issues}
                                                        defaultExpanded={group.defaultExpanded}
                                                    />
                                                </div>
                                            ))}
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in zoom-in-95 flex flex-col items-center justify-center rounded-xl border border-primary/20 bg-primary/5 py-8 duration-500">
                                        <div className="mb-1 flex gap-1">
                                            {["✨", "🌟", "✨"].map((emoji, i) => (
                                                <span
                                                    key={i}
                                                    className="animate-pulse text-lg"
                                                    style={{
                                                        animationDelay: `${i * 200}ms`,
                                                        animationDuration: "1.5s"
                                                    }}
                                                >
                                                    {emoji}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="animate-in fade-in slide-in-from-bottom-2 text-sm font-medium text-primary delay-200 duration-500">
                                            No issues found! Your documentation is in great shape.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
