"use client";

import {
  ChatBubbleLeftEllipsisIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { AnalyticsHistogramTabItem } from "./AnalyticsHistogramTabItem";
import { RenderType } from "./AnalyticsPageClient";

export function AnalyticsHistogramTabBar({
  renderType,
  onChangeRenderType,
}: {
  renderType: RenderType;
  onChangeRenderType: (type: RenderType) => void;
}) {
  return (
    <div className="flex min-w-0">
      <AnalyticsHistogramTabItem
        title="Queries"
        icon={<SparklesIcon className="h-4 w-4" />}
        isSelected={renderType === "QUERIES"}
        onClick={() => {
          onChangeRenderType("QUERIES");
        }}
      />
      <AnalyticsHistogramTabItem
        title="Conversations"
        icon={<ChatBubbleLeftEllipsisIcon className="h-4 w-4" />}
        isSelected={renderType === "CONVERSATIONS"}
        onClick={() => {
          onChangeRenderType("CONVERSATIONS");
        }}
      />
    </div>
  );
}
