import { forwardRef } from "react";

import { SemanticColor } from "../colors";
import { SemanticBadge, type SemanticBadgeProps } from "./semantic-badge";

interface StatusCodeBadgeProps extends Omit<SemanticBadgeProps, "intent"> {
    statusCode: number | string;
    isWildcard?: boolean;
}

const STATIC_CODE_INTENTS: Record<string, SemanticColor> = {
    1: SemanticColor.Info,
    2: SemanticColor.Success,
    3: SemanticColor.Warning,
    4: SemanticColor.Error,
    5: SemanticColor.Error
};

export const StatusCodeBadge = forwardRef<HTMLSpanElement & HTMLButtonElement, StatusCodeBadgeProps>(
    ({ statusCode, isWildcard, ...props }, ref) => {
        const statusCodeString = String(statusCode);
        const displayValue = formatStatusCode(statusCode, isWildcard);
        return (
            <SemanticBadge
                {...props}
                ref={ref}
                data-badge-type="status-code"
                data-status-code={displayValue}
                data-status-level={`${statusCodeString[0]}xx`}
                intent={statusCodeToIntent(statusCodeString)}
            >
                {props.children ?? displayValue}
            </SemanticBadge>
        );
    }
);

StatusCodeBadge.displayName = "StatusCodeBadge";

export function statusCodeToIntent(statusCode: string): SemanticColor {
    return STATIC_CODE_INTENTS[statusCode[0] ?? ""] ?? SemanticColor.None;
}

export function formatStatusCode(statusCode: number | string, isWildcard?: boolean): string {
    const statusCodeNum = typeof statusCode === "string" ? parseInt(statusCode, 10) : statusCode;
    if (isWildcard) {
        const level = Math.floor(statusCodeNum / 100);
        return `${level}XX`;
    }
    return String(statusCode);
}
