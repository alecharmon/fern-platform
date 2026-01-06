export interface DocsScoreIssue {
    page: string;
    issueType: string;
    suggestedFix: string;
}

export interface DocsScoreCategory {
    categoryName: string;
    issues: DocsScoreIssue[];
}

export interface DocsScoreData {
    categories: DocsScoreCategory[];
}

export function generateDocsScore(domain: string): { score: number; data: DocsScoreData } {
    return {
        score: 85,
        data: {
            categories: [
                {
                    categoryName: "Accessibility",
                    issues: [
                        {
                            page: `https://${domain}/docs/getting-started`,
                            issueType: "Missing alt text",
                            suggestedFix: "Add descriptive alt text to images"
                        }
                    ]
                },
                {
                    categoryName: "SEO",
                    issues: [
                        {
                            page: `https://${domain}/docs/api-reference`,
                            issueType: "Missing meta description",
                            suggestedFix: "Add a meta description tag to improve search visibility"
                        },
                        {
                            page: `https://${domain}/docs/quickstart`,
                            issueType: "Duplicate title tag",
                            suggestedFix: "Use unique title tags for each page"
                        }
                    ]
                },
                {
                    categoryName: "Performance",
                    issues: []
                }
            ]
        }
    };
}
