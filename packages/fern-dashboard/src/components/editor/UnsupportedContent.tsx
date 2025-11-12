"use client";

import { EditInDevModeButton } from "./EditInDevModeButton";

export const UnsupportedContent = ({ children }: { children: React.ReactNode }) => {
    return (
        <UnsupportedContentDisplayOnly>
            <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                <EditInDevModeButton className="w-fit bg-gray-300 hover:bg-gray-500/80" />
            </div>
            {children}
        </UnsupportedContentDisplayOnly>
    );
};

export const UnsupportedContentDisplayOnly = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="border-l-1 min-h-13 relative mb-4 block w-full overflow-hidden !whitespace-pre-wrap rounded-r-xl border-gray-800 bg-gray-300/50 p-3">
            {children}
        </div>
    );
};

export const UnsupportedContentInline = ({ tagName }: { tagName?: string }) => {
    return (
        <span className="inline-flex min-w-fit items-center rounded-md bg-gray-300/50 px-2 py-1 text-xs">
            {tagName ? `Unsupported tag: ${tagName}` : "Unsupported tag"}
        </span>
    );
};
