"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { type FeedbackEntry, getFeedback } from "@/app/actions/getFeedback";
import type { DateRangeOptions } from "@/app/services/posthog/types";
import { useSidepanel } from "@/components/layout/SidepanelContext";

import { FeedbackSidePanel } from "./FeedbackSidePanel";
import { FeedbackTable } from "./FeedbackTable";

interface FeedbackPageProps {
    docsUrl: string;
}

export function FeedbackPage({ docsUrl }: FeedbackPageProps) {
    const [dateRange, setDateRange] = useState<DateRangeOptions>({
        type: "last_n_days",
        days: 7
    });
    const [page, setPage] = useState(1);
    const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
    const { setContent, clear } = useSidepanel();

    const { data, isLoading, error } = useQuery({
        queryKey: ["feedback", docsUrl, dateRange, page],
        queryFn: () =>
            getFeedback({
                docsUrl,
                dateRange,
                page
            }),
        refetchInterval: 60000
    });

    useEffect(() => {
        if (selectedFeedback) {
            setContent(<FeedbackSidePanel feedback={selectedFeedback} onClose={clear} />);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFeedback]);

    const handleDateRangeChange = (newDateRange: DateRangeOptions) => {
        setDateRange(newDateRange);
        setPage(1);
    };

    return (
        <div className="flex w-full flex-col gap-4">
            <FeedbackTable
                feedback={data?.feedback ?? []}
                isLoading={isLoading}
                error={error}
                dateRange={dateRange}
                setDateRange={handleDateRangeChange}
                onRowClick={setSelectedFeedback}
                pagination={
                    data?.pagination ?? {
                        page: 1,
                        pageSize: 100,
                        hasMore: false
                    }
                }
                onPageChange={setPage}
            />
        </div>
    );
}
