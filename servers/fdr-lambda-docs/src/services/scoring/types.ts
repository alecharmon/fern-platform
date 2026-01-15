export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface DocsScoreIssue {
    page: string;
    issueType: string;
    suggestedFix: string;
    severity: IssueSeverity;
}

export interface CategoryResult {
    categoryName: string;
    issues: DocsScoreIssue[];
}

export interface PageData {
    url: string;
    html: string;
}

export interface IssueCounts {
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export interface DocsScoreData {
    issueCounts: IssueCounts;
    issues: DocsScoreIssue[];
}
