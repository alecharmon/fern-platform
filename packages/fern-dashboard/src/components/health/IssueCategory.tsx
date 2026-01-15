"use client";

import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import type { DocsScoreIssue, IssueSeverity } from "@/app/actions/getDocsScore";
import { cn } from "@/utils/utils";

interface IssueSeverityGroupProps {
    severity: IssueSeverity;
    issues: DocsScoreIssue[];
    defaultExpanded?: boolean;
}

const SEVERITY_CONFIG: Record<
    IssueSeverity,
    { label: string; badgeClass: string; borderClass: string; bgClass: string }
> = {
    critical: {
        label: "Critical",
        badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        borderClass: "border-red-200 dark:border-red-800",
        bgClass: "bg-red-50/50 dark:bg-red-900/10"
    },
    high: {
        label: "High",
        badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        borderClass: "border-red-200 dark:border-red-800",
        bgClass: "bg-red-50/50 dark:bg-red-900/10"
    },
    medium: {
        label: "Medium",
        badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        borderClass: "border-amber-200 dark:border-amber-800",
        bgClass: "bg-amber-50/50 dark:bg-amber-900/10"
    },
    low: {
        label: "Low",
        badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        borderClass: "border-blue-200 dark:border-blue-800",
        bgClass: "bg-blue-50/50 dark:bg-blue-900/10"
    }
};

function extractBrokenLink(suggestedFix: string): string | null {
    const match = suggestedFix.match(/Fix or remove broken link: (.+)$/);
    return match?.[1] ?? null;
}

function IssueRow({ issue, index }: { issue: DocsScoreIssue; index: number }) {
    const isBrokenLink = issue.issueType.startsWith("Broken link");
    const brokenLinkUrl = isBrokenLink ? extractBrokenLink(issue.suggestedFix) : null;

    return (
        <div
            className="animate-in fade-in slide-in-from-top-1 px-4 py-3 duration-200"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{issue.issueType}</span>
                    </div>
                    {brokenLinkUrl ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                            Broken link:{" "}
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{brokenLinkUrl}</code>
                        </p>
                    ) : (
                        <p className="mt-1.5 text-sm text-muted-foreground">{issue.suggestedFix}</p>
                    )}
                    <a
                        href={issue.page}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                        {issue.page}
                        <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function IssueSeverityGroup({ severity, issues, defaultExpanded = false }: IssueSeverityGroupProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const issueCount = issues.length;
    const config = SEVERITY_CONFIG[severity];

    if (issueCount === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                "overflow-hidden rounded-lg border transition-all duration-300",
                config.borderClass,
                isExpanded && config.bgClass
            )}
        >
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
                <div className="flex items-center gap-3">
                    <ChevronRightIcon
                        className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out",
                            isExpanded && "rotate-90"
                        )}
                    />
                    <span className="font-medium">{config.label}</span>
                </div>
                <span
                    className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-300",
                        config.badgeClass,
                        isExpanded && "scale-105"
                    )}
                >
                    {issueCount} {issueCount === 1 ? "issue" : "issues"}
                </span>
            </button>

            <div
                className={cn(
                    "grid transition-all duration-300 ease-out",
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
            >
                <div className="overflow-hidden">
                    <div className="divide-y divide-border border-t border-border">
                        {isExpanded &&
                            issues.map((issue, index) => <IssueRow key={index} issue={issue} index={index} />)}
                    </div>
                </div>
            </div>
        </div>
    );
}
