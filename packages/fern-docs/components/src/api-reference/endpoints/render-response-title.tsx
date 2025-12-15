import { StatusCodeBadge, statusCodeToIntent } from "../../badges/status-code-badge";
import { cn } from "../../cn";

export function renderResponseTitle(
    title: string,
    statusCode: number | string,
    hideTitle?: boolean,
    isWildcard?: boolean
) {
    return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <StatusCodeBadge statusCode={statusCode} isWildcard={isWildcard} />
            {!hideTitle && (
                <span className={cn("truncate max-w-full", `text-intent-${statusCodeToIntent(String(statusCode))}`)}>
                    {title}
                </span>
            )}
        </span>
    );
}
