import type React from "react";
import type { PropsWithChildren } from "react";

import { CopyToClipboardButton } from "../CopyToClipboardButton";
import { cn } from "../cn";
import { ExpandCodeButton } from "../ExpandCodeButton";

type CodeBlockWithClipboardButtonProps = {
    code: string | (() => string | Promise<string>);
    className?: string;
    expandable?: boolean;
    language?: string;
    showFeedbackButton?: boolean;
    feedbackButton?: React.ReactNode;
    lang: string;
};

export const CodeBlockWithClipboardButton: React.FC<PropsWithChildren<CodeBlockWithClipboardButtonProps>> = ({
    code,
    children,
    className,
    expandable,
    language,
    showFeedbackButton = true,
    feedbackButton,
    lang
}) => {
    return (
        <div
            className={cn(
                "not-prose bg-card-background border-card-border rounded-3 shadow-card-grayscale group relative mb-6 mt-4 flex w-full border",
                className
            )}
        >
            {children}
            <div className="absolute right-2 top-2 z-20 flex items-center gap-1 backdrop-blur">
                {expandable && (
                    <ExpandCodeButton className="fern-expand-button" content={code} language={language} lang={lang} />
                )}
                {showFeedbackButton && feedbackButton}
                <CopyToClipboardButton className="fern-copy-button" content={code} />
            </div>
        </div>
    );
};
