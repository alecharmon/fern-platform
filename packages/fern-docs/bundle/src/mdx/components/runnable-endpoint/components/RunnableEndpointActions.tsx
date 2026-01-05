import { FernButton } from "@fern-docs/components/FernButton";
import { t } from "@fern-docs/i18n";
import { RotateCcw, SendHorizonal } from "lucide-react";

interface RunnableEndpointActionsProps {
    onClear: () => void;
    onSend: () => void;
    isSending: boolean;
    lang: string;
}

export function RunnableEndpointActions({ onClear, onSend, isSending, lang }: RunnableEndpointActionsProps) {
    return (
        <div className="fern-runnable-actions border-border-default bg-tag-default flex items-center justify-between px-3 py-2">
            <FernButton onClick={onClear} variant="outlined" intent="none" className="fern-runnable-clear-button group">
                <span className="flex flex-row items-center">
                    <RotateCcw className="mr-2 size-4 transition-transform group-hover:rotate-180" />
                    {t(lang).buttons.clear}
                </span>
            </FernButton>

            <FernButton
                onClick={onSend}
                disabled={isSending}
                variant="filled"
                intent="primary"
                className="fern-runnable-send-button group overflow-visible"
            >
                <span className="flex flex-row items-center font-medium">
                    {isSending ? "Sending..." : t(lang).buttons.sendRequest}
                    <SendHorizonal className="ml-2 mr-0.5 size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
            </FernButton>
        </div>
    );
}
