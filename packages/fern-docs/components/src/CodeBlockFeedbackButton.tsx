"use client";

import { t } from "@fern-docs/i18n";
import { Flag } from "lucide-react";
import { useState } from "react";
import { cn } from "./cn";
import { Button } from "./FernButtonV2";
import { FernTooltip, FernTooltipProvider } from "./FernTooltip";

export declare namespace CodeBlockFeedbackButton {
    export interface Props {
        className?: string;
        code?: string;
        language?: string;
        onFeedbackSubmit?: (feedback: { message: string; code: string; language?: string }) => void;
        lang: string;
    }
}

export const CodeBlockFeedbackButton: React.FC<CodeBlockFeedbackButton.Props> = ({
    className,
    code,
    language,
    onFeedbackSubmit,
    lang
}) => {
    const [isOpen, setIsOpen] = useState(false);

    if (code == null) {
        return null;
    }

    return (
        <FernTooltipProvider>
            <FernTooltip content={t(lang).feedback.reportIncorrectCode}>
                <Button
                    className={cn("fern-feedback-button", className)}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOpen(true);
                    }}
                    variant="ghost"
                    size="iconSm"
                >
                    <Flag />
                </Button>
            </FernTooltip>
            {isOpen && (
                <CodeBlockFeedbackModal
                    code={code}
                    language={language}
                    open={isOpen}
                    onOpenChange={setIsOpen}
                    onSubmit={onFeedbackSubmit}
                    lang={lang}
                />
            )}
        </FernTooltipProvider>
    );
};

interface CodeBlockFeedbackModalProps {
    code: string;
    language?: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit?: (feedback: { message: string; code: string; language?: string }) => void;
    lang: string;
}

const CodeBlockFeedbackModal: React.FC<CodeBlockFeedbackModalProps> = ({
    code,
    language,
    open,
    onOpenChange,
    onSubmit,
    lang
}) => {
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            return;
        }

        setIsSubmitting(true);
        try {
            onSubmit?.({ message, code, language });
            onOpenChange(false);
            setMessage("");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!open) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
        >
            <div
                className="bg-card-solid border-border-default rounded-2 w-full max-w-md border p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-lg font-semibold mb-4">{t(lang).feedback.reportIncorrectCode}</h2>
                <p className="text-(color:--grayscale-a11) text-sm mb-4">
                    {t(lang).feedback.helpUsImproveByReportingCodeExample}
                </p>
                <form onSubmit={handleSubmit}>
                    <textarea
                        className="bg-card-background border-border-default rounded-2 w-full border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary"
                        rows={4}
                        placeholder={t(lang).feedback.whatIsWrongWithThisCodeExample}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        autoFocus
                    />
                    <div className="mt-4 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            {t(lang).buttons.cancel}
                        </Button>
                        <Button type="submit" variant="default" disabled={!message.trim() || isSubmitting}>
                            {isSubmitting ? t(lang).buttons.submitting : t(lang).buttons.submit}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
