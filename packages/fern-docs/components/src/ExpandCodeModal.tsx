"use client";

import { t } from "@fern-docs/i18n";
import { X } from "lucide-react";
import React, { useState } from "react";
import { createPortal } from "react-dom";

import { CopyToClipboardButton } from "./CopyToClipboardButton";
import { Button } from "./FernButtonV2";
import { FernSyntaxHighlighter } from "./syntax-highlighter/FernSyntaxHighlighter";

export declare namespace ExpandCodeModal {
    export interface Props {
        code: string | (() => string | Promise<string>);
        language?: string;
        title?: string;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
        lang: string;
    }
}

export const ExpandCodeModal: React.FC<ExpandCodeModal.Props> = ({
    code,
    language = "plaintext",
    open,
    onOpenChange,
    lang
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [codeContent, setCodeContent] = useState<string>("");
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (open && code) {
            setIsLoading(true);
            const resolveCode = async () => {
                try {
                    const resolved = typeof code === "function" ? await code() : code;
                    setCodeContent(resolved);
                } catch (error) {
                    console.error("Error resolving code:", error);
                    setCodeContent("");
                } finally {
                    setIsLoading(false);
                }
            };
            void resolveCode();
        }
    }, [open, code]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onOpenChange?.(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            onOpenChange?.(false);
        }
    };

    if (!open || !mounted) {
        return null;
    }

    const modalContent = (
        <div className="fixed inset-0 top-[var(--header-height)] z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={handleBackdropClick} />
            <div
                className="bg-card-solid rounded-3 shadow-card-grayscale relative mx-4 flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden"
                onKeyDown={handleKeyDown}
            >
                <div className="flex-1 overflow-scroll">
                    {isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                            <div className="text-muted-foreground text-sm">{t(lang).status.loading}</div>
                        </div>
                    ) : (
                        <div>
                            <FernSyntaxHighlighter
                                code={codeContent}
                                language={language}
                                className="text-sm"
                                wordWrap={true}
                            />
                            <CopyToClipboardButton content={codeContent} className="absolute right-3 top-2 h-8 w-8" />
                            <Button
                                variant="ghost"
                                size="iconSm"
                                onClick={() => onOpenChange?.(false)}
                                className="absolute right-12 top-2 h-8 w-8"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
