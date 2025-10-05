import type React from "react";
import type { PropsWithChildren } from "react";

import { CopyToClipboardButton } from "../CopyToClipboardButton";
import { ExpandCodeButton } from "../ExpandCodeButton";
import { cn } from "../cn";

type CodeBlockWithClipboardButtonProps = {
    code: string | (() => string | Promise<string>);
    className?: string;
    expandable?: boolean;
    language?: string;
};

export const CodeBlockWithClipboardButton: React.FC<PropsWithChildren<CodeBlockWithClipboardButtonProps>> = ({
    code,
    children,
    className,
    expandable,
    language
}) => {
    return (
        <div
            className={cn(
                "not-prose bg-card-background border-card-border rounded-3 shadow-card-grayscale group relative mb-6 mt-4 flex w-full border",
                className
            )}
        >
            {children}
            {expandable && (
                <ExpandCodeButton
                    className={cn(
                        "fern-expand-button absolute z-20",
                        "opacity-0 backdrop-blur transition group-hover:opacity-100",
                        "right-9 top-2"
                    )}
                    content={code}
                    language={language}
                />
            )}
            <CopyToClipboardButton
                className={cn(
                    "fern-copy-button absolute z-20",
                    "opacity-0 backdrop-blur transition group-hover:opacity-100",
                    "right-2 top-2"
                )}
                content={code}
            />
        </div>
    );
};
