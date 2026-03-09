import { err, ok, type Result } from "neverthrow";
import type { ServiceAuthError } from "./errors.js";

const encoder = new TextEncoder();

export function resolveSecret(secret?: string): Result<Uint8Array, ServiceAuthError> {
    const resolved = secret ?? process.env.JWT_SECRET_KEY;
    if (!resolved) {
        return err({
            source: "service-jwt-auth",
            code: "NOT_CONFIGURED",
            message: "No secret provided and JWT_SECRET_KEY environment variable is not set"
        });
    }
    return ok(encoder.encode(resolved));
}
