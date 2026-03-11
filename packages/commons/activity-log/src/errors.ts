export type ActivityLogErrorCode =
    | "NOT_CONFIGURED"
    | "NOT_FOUND"
    | "QUERY_FAILED"
    | "INSERT_FAILED"
    | "INVALID_EVENT_TYPE";

export interface ActivityLogError {
    source: "activity-log";
    code: ActivityLogErrorCode;
    message: string;
    cause?: unknown;
}

export function activityLogError(code: ActivityLogErrorCode, message: string, cause?: unknown): ActivityLogError {
    return { source: "activity-log", code, message, cause };
}
