"use client";

import type { FernAI } from "@fern-api/fai-sdk";

import { cn } from "@/utils/utils";

import { BORDER_STYLES } from "./AnalyticsPageClient";

interface ConversationResolutionCardProps {
    resolutionData: FernAI.GetConversationResolutionResponse;
}

export function ConversationResolutionCard({ resolutionData }: ConversationResolutionCardProps) {
    const { total_conversations, resolved_conversations, unresolved_conversations, resolution_rate } = resolutionData;

    return (
        <div className={cn(BORDER_STYLES, "border-gray-0 w-full border")}>
            <h3 className="mb-4 text-lg font-semibold">Conversation Resolution</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="flex flex-col">
                    <span className="mb-1 text-sm text-gray-500">Total Conversations</span>
                    <span className="text-2xl font-bold">{total_conversations}</span>
                </div>
                <div className="flex flex-col">
                    <span className="mb-1 text-sm text-gray-500">Resolved</span>
                    <span className="text-2xl font-bold text-green-600">{resolved_conversations}</span>
                </div>
                <div className="flex flex-col">
                    <span className="mb-1 text-sm text-gray-500">Unresolved</span>
                    <span className="text-2xl font-bold text-orange-600">{unresolved_conversations}</span>
                </div>
                <div className="flex flex-col">
                    <span className="mb-1 text-sm text-gray-500">Resolution Rate</span>
                    <span className="text-2xl font-bold text-blue-600">{resolution_rate.toFixed(1)}%</span>
                </div>
            </div>
            <div className="mt-4">
                <div className="relative h-4 overflow-hidden rounded-full bg-gray-200">
                    <div
                        className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${resolution_rate}%` }}
                    />
                </div>
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
        </div>
    );
}
