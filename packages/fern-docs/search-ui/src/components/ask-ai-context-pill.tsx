import type { ReactNode } from "react";

import { BookOpen, X } from "lucide-react";

export const AskAiContextPill = ({
    pageContext,
    onRemove,
    onSelectHit
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
                padding: "0 4px 0 8px"
            }}
            onClick={handleClick}
            title={`Click to open: ${pageContext.title}`}
        >
            <div className="flex w-full flex-row items-center justify-between">
                <BookOpen size={16} color="var(--accent-contrast)" />
                <div
                    className="mx-2 flex min-w-0 flex-1 items-center overflow-hidden hover:underline"
                    style={{
                        fontSize: "12px",
                        fontStyle: "normal",
                        fontWeight: "500",
                        lineHeight: "16px",
                        color: "var(--accent-contrast)"
                    }}
                >
                    <span className="truncate">{pageContext.title}</span>
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
        </div>
    );
};
