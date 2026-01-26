export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

export type LogFields = Record<string, unknown>;

/**
 * Minimal structured logger interface.
 *
 * Designed for DI (dependency injection): callers can pass pino/winston adapters,
 * while the generator can remain logger-agnostic.
 *
 * The signature is intentionally "fields first" to encourage structured logs.
 */
export interface Logger {
    debug(fields: LogFields, message?: string): void;
    info(fields: LogFields, message?: string): void;
    warn(fields: LogFields, message?: string): void;
    error(fields: LogFields, message?: string): void;

    /**
     * Return a logger with bound fields (e.g. `{ runId, baseUrl }`).
     */
    child(fields: LogFields): Logger;
}

export type ConsoleLogFormat = "json" | "pretty";

const LOG_LEVEL_RANK: Record<Exclude<LogLevel, "silent">, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

function shouldLog(level: LogLevel, messageLevel: Exclude<LogLevel, "silent">): boolean {
    if (level === "silent") {
        return false;
    }
    return LOG_LEVEL_RANK[messageLevel] <= LOG_LEVEL_RANK[level];
}

/**
 * Console-backed JSON logger.
 *
 * This is a reasonable default for CLI usage and also works well with log shippers.
 */
export function createConsoleJsonLogger(bindings: LogFields = {}): Logger {
    const baseBindings = { ...bindings };

    const write = (level: Exclude<LogLevel, "silent">, fields: LogFields, message?: string) => {
        // Note: keep this stable for log collectors.
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...baseBindings,
            ...fields
        };
        // biome-ignore lint/suspicious/noConsole: this is the console logger implementation
        console.log(JSON.stringify(payload));
    };

    return {
        debug(fields, message) {
            write("debug", fields, message);
        },
        info(fields, message) {
            write("info", fields, message);
        },
        warn(fields, message) {
            write("warn", fields, message);
        },
        error(fields, message) {
            write("error", fields, message);
        },
        child(fields) {
            return createConsoleJsonLogger({ ...baseBindings, ...fields });
        }
    };
}

function formatPrettyValue(value: unknown): string {
    if (value == null) {
        return "null";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Console-backed pretty logger.
 *
 * Intended for local CLI/dev usage. It prints a compact single-line format and
 * intentionally hides high-cardinality fields like `runId` by default.
 */
export function createPrettyConsoleLogger(
    bindings: LogFields = {},
    opts?: {
        includeTimestamp?: boolean;
        includeRunId?: boolean;
        includeBaseUrl?: boolean;
    }
): Logger {
    const baseBindings = { ...bindings };
    const options = {
        includeTimestamp: opts?.includeTimestamp ?? false,
        includeRunId: opts?.includeRunId ?? false,
        includeBaseUrl: opts?.includeBaseUrl ?? false
    };

    const write = (level: Exclude<LogLevel, "silent">, fields: LogFields, message?: string) => {
        const merged = { ...baseBindings, ...fields };
        const event = typeof merged.event === "string" ? merged.event : undefined;

        // Drop noisy fields unless explicitly requested.
        const suppressed = new Set<string>(["event", "component"]);
        if (!options.includeRunId) {
            suppressed.add("runId");
        }
        if (!options.includeBaseUrl) {
            suppressed.add("baseUrl");
        }

        const parts: string[] = [];
        if (options.includeTimestamp) {
            parts.push(new Date().toISOString());
        }
        parts.push(level.toUpperCase());
        if (event) {
            parts.push(event);
        }
        if (message && message.trim() !== "") {
            parts.push("-", message);
        }

        // Render a small set of useful fields (sorted for stability).
        const fieldPairs = Object.entries(merged)
            .filter(([k, v]) => !suppressed.has(k) && v !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${formatPrettyValue(v)}`);

        const line = fieldPairs.length > 0 ? `${parts.join(" ")} ${fieldPairs.join(" ")}` : parts.join(" ");

        // biome-ignore lint/suspicious/noConsole: this is the console logger implementation
        console.log(line);
    };

    return {
        debug(fields, message) {
            write("debug", fields, message);
        },
        info(fields, message) {
            write("info", fields, message);
        },
        warn(fields, message) {
            write("warn", fields, message);
        },
        error(fields, message) {
            write("error", fields, message);
        },
        child(fields) {
            return createPrettyConsoleLogger({ ...baseBindings, ...fields }, options);
        }
    };
}

/**
 * Wrap a logger to enforce a log level. The returned logger always exposes all methods,
 * but no-ops calls that are below the configured level.
 */
export function withLogLevel(logger: Logger, level: LogLevel): Logger {
    const maybeLog = (messageLevel: Exclude<LogLevel, "silent">, fields: LogFields, message?: string) => {
        if (shouldLog(level, messageLevel)) {
            logger[messageLevel](fields, message);
        }
    };

    return {
        debug(fields, message) {
            maybeLog("debug", fields, message);
        },
        info(fields, message) {
            maybeLog("info", fields, message);
        },
        warn(fields, message) {
            maybeLog("warn", fields, message);
        },
        error(fields, message) {
            maybeLog("error", fields, message);
        },
        child(fields) {
            return withLogLevel(logger.child(fields), level);
        }
    };
}
