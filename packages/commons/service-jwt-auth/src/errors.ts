export interface ServiceAuthError {
    source: "service-jwt-auth";
    code: "NOT_CONFIGURED" | "INVALID_TOKEN" | "TOKEN_EXPIRED" | "INVALID_SERVICE";
    message: string;
    cause?: unknown;
}
