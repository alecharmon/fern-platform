"use client";

import { useSidepanel } from "@/components/layout/SidepanelContext";

export default function FeedbackSidepanel() {
    const { content } = useSidepanel();

    return (
        <div
            className={`h-full w-full overflow-y-auto bg-[var(--gray-100)] transition-all duration-500 ease-out md:rounded-t-2xl md:pr-2`}
        >
            {content}
        </div>
    );
}
