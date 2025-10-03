import { DashboardTooltip } from "../../../../components/editor/DashboardTooltip";

export function EditorPreviewBanner({ name }: { name: string }) {
  return (
    <div className="border-card-border bg-(color:--grayscale-a2) border-t px-3 py-1.5">
      <div className="text-(color:--grayscale-a11) flex items-center gap-1.5 text-xs">
        <DashboardTooltip
          content={`${name} is a work in progress, expect updates`}
        >
          <span className="flex items-center gap-1.5">
            {name} Beta
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
        </DashboardTooltip>
      </div>
    </div>
  );
}
