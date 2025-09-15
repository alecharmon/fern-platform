import { ReactNode } from "react";

import { BookOpen, X } from "lucide-react";

export const AskAiContextPill = ({
  pageContext,
  onRemove,
  onSelectHit,
}: {
  pageContext?: { title: string; url: string } | null;
  onRemove?: () => void;
  onSelectHit?: (path: string) => void;
}): ReactNode => {
  if (!pageContext) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectHit?.(pageContext.url);
  };

  return (
    <div
      className="border-border-default bg-(color:--accent) hover:bg-(color:--accent-a10) flex cursor-pointer items-center justify-between px-4 py-2 text-white transition-colors"
      style={{
        borderRadius: "8px",
        margin: "0 16px",
        height: "32px",
        padding: "0 4px 0 8px",
      }}
      onClick={handleClick}
      title={`Click to open: ${pageContext.title}`}
    >
      <div className="flex flex-row items-center gap-[4px]">
        <BookOpen size={16} color="var(--accent-contrast)" />
        <div
          className="flex items-center hover:underline"
          style={{
            fontSize: "12px",
            fontStyle: "normal",
            fontWeight: "500",
            lineHeight: "16px",
            color: "var(--accent-contrast)",
          }}
        >
          {pageContext.title}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="hover:bg-(color:--accent-a20) rounded p-1 transition-colors hover:cursor-pointer"
          title="Remove context"
        >
          <X size={16} color="var(--accent-contrast)" />
        </button>
      )}
    </div>
  );
};
