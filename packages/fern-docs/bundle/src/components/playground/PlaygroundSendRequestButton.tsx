import { cn } from "@fern-docs/components/cn";

import { FernButton } from "@fern-docs/components/FernButton";
import { FernTooltip, FernTooltipProvider } from "@fern-docs/components/FernTooltip";
import type { FC, ReactNode } from "react";

import { I18N } from "@/constants";

interface PlaygroundSendRequestButtonProps {
    sendRequest?: () => void;
    disabled?: boolean;
    sendRequestButtonLabel?: string;
    sendRequestIcon?: ReactNode;
}

export const PlaygroundSendRequestButton: FC<PlaygroundSendRequestButtonProps> = ({
    sendRequest,
    sendRequestButtonLabel,
    sendRequestIcon,
    disabled
}) => {
    return (
        <FernTooltipProvider>
            <FernTooltip content={disabled ? I18N.playground.cannotSendToLocalhost : undefined}>
                <FernButton
                    className={cn("group relative overflow-hidden font-semibold", {
                        "after:animate-shine after:absolute after:inset-y-0 after:w-8 after:bg-white/50 after:blur after:content-['']":
                            !!sendRequest
                    })}
                    rightIcon={sendRequestIcon}
                    onClick={sendRequest}
                    intent="primary"
                    rounded
                    size="large"
                    skeleton={!sendRequest}
                    disabled={disabled}
                >
                    {sendRequestButtonLabel ?? I18N.buttons.sendRequest}
                </FernButton>
            </FernTooltip>
        </FernTooltipProvider>
    );
};
