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
            <h3 className="text-lg font-semibold mb-4">Conversation Resolution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500 mb-1">Total Conversations</span>
                    <span className="text-2xl font-bold">{total_conversations}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500 mb-1">Resolved</span>
                    <span className="text-2xl font-bold text-green-600">{resolved_conversations}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500 mb-1">Unresolved</span>
                    <span className="text-2xl font-bold text-orange-600">{unresolved_conversations}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500 mb-1">Resolution Rate</span>
                    <span className="text-2xl font-bold text-blue-600">{resolution_rate.toFixed(1)}%</span>
                </div>
            </div>
            <div className="mt-4">
                <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${resolution_rate}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>0%</span>
                    <span>100%</span>
                </div>
            </div>
        </div>
    );
}
