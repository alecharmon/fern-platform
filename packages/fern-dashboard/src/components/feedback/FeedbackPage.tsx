"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { type FeedbackEntry, getFeedback } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { useSidepanel } from "@/components/layout/SidepanelContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CodeIssuesTable } from "./CodeIssuesTable";
import { FeedbackSidePanel } from "./FeedbackSidePanel";
import { FeedbackTable } from "./FeedbackTable";

interface FeedbackPageProps {
    docsUrl: string;
    initialData?: Awaited<ReturnType<typeof getFeedback>>;
}

export function FeedbackPage({ docsUrl, initialData }: FeedbackPageProps) {
    const [dateRange, setDateRange] = useState<DateRangeOptions>({
        type: "last_n_days",
        days: 7
    });
    const [allFeedbackPage, setAllFeedbackPage] = useState(1);
    const [codeIssuesPage, setCodeIssuesPage] = useState(1);
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
    const { setContent, clear } = useSidepanel();

    const {
        data: allFeedbackData,
        isLoading: allFeedbackLoading,
        error: allFeedbackError
    } = useQuery({
        queryKey: ["feedback", "all", docsUrl, dateRange, allFeedbackPage],
        queryFn: () =>
            getFeedback({
                docsUrl,
                dateRange,
                page: allFeedbackPage
            }),
        initialData:
            allFeedbackPage === 1 && dateRange.type === "last_n_days" && dateRange.days === 7 ? initialData : undefined,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false
    });

    const {
        data: codeIssuesData,
        isLoading: codeIssuesLoading,
        error: codeIssuesError
    } = useQuery({
        queryKey: ["feedback", "code-issues", docsUrl, dateRange, codeIssuesPage],
        queryFn: () =>
            getFeedback({
                docsUrl,
                dateRange,
                page: codeIssuesPage
            }),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false
    });

    // biome-ignore lint/correctness/useExhaustiveDependencies: only run when selectedFeedback changes
    useEffect(() => {
        if (selectedFeedback) {
            setContent(<FeedbackSidePanel feedback={selectedFeedback} onClose={clear} />);
        }
    }, [selectedFeedback]);

    const handleDateRangeChange = (newDateRange: DateRangeOptions) => {
        setDateRange(newDateRange);
        setAllFeedbackPage(1);
        setCodeIssuesPage(1);
    };

    const allFeedback = allFeedbackData?.feedback ?? [];
    const pageFeedback = allFeedback.filter((f) => f.feedbackType !== "code_block");
    const codeIssues = codeIssuesData?.feedback.filter((f) => f.feedbackType === "code_block") ?? [];

    return (
        <div className="flex w-full flex-col gap-4">
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">On-Page Feedback</TabsTrigger>
                    <TabsTrigger value="code-issues">Code Issues</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    <FeedbackTable
                        feedback={pageFeedback}
                        isLoading={allFeedbackLoading}
                        error={allFeedbackError}
                        dateRange={dateRange}
                        setDateRange={handleDateRangeChange}
                        onRowClick={setSelectedFeedback}
                        pagination={
                            allFeedbackData?.pagination ?? {
                                page: allFeedbackPage,
                                pageSize: 100,
                                hasMore: false
                            }
                        }
                        onPageChange={setAllFeedbackPage}
                        docsUrl={docsUrl}
                        getFeedbackAction={getFeedback}
                    />
                </TabsContent>
                <TabsContent value="code-issues">
                    <CodeIssuesTable
                        codeIssues={codeIssues}
                        isLoading={codeIssuesLoading}
                        error={codeIssuesError}
                        dateRange={dateRange}
                        setDateRange={handleDateRangeChange}
                        onRowClick={setSelectedFeedback}
                        pagination={
                            codeIssuesData?.pagination ?? {
                                page: codeIssuesPage,
                                pageSize: 100,
                                hasMore: false
                            }
                        }
                        onPageChange={setCodeIssuesPage}
                        docsUrl={docsUrl}
                        getFeedbackAction={getFeedback}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
