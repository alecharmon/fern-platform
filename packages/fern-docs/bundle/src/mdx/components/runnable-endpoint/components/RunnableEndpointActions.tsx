import { FernButton } from "@fern-docs/components/FernButton";
import { RotateCcw, SendHorizonal } from "lucide-react";

interface RunnableEndpointActionsProps {
    onClear: () => void;
    onSend: () => void;
    isSending: boolean;
}

export function RunnableEndpointActions({ onClear, onSend, isSending }: RunnableEndpointActionsProps) {
    return (
        <div className="border-border-default bg-tag-default flex items-center justify-between border-b px-3 py-2">
            <FernButton onClick={onClear} variant="outlined" intent="none" className="group">
                <span className="flex flex-row items-center">
                    <RotateCcw className="mr-2 size-4 transition-transform group-hover:rotate-180" />
                    Clear
                </span>
            </FernButton>

            <FernButton
                onClick={onSend}
                disabled={isSending}
                variant="filled"
                intent="primary"
                className="group overflow-visible"
            >
                <span className="flex flex-row items-center font-medium">
                    {isSending ? "Sending..." : "Send Request"}
                    <SendHorizonal className="ml-2 mr-0.5 size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
            </FernButton>
        </div>
    );
}
