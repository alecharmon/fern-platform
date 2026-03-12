/** biome-ignore-all lint/suspicious/noConsole: logger wraps console */

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4
};

const VALID_LEVELS = new Set<string>(Object.keys(LEVEL_PRIORITY));

function resolveLevel(): LogLevel {
    const env = process.env.FERN_LOG_LEVEL?.toLowerCase();
    if (env && VALID_LEVELS.has(env)) {
        return env as LogLevel;
    }
    return "warn";
}

const currentLevel = resolveLevel();
const currentPriority = LEVEL_PRIORITY[currentLevel];

function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= currentPriority;
}

export const logger = {
    trace(...args: unknown[]): void {
        if (shouldLog("trace")) {
            console.debug("[trace]", ...args);
        }
    },
    debug(...args: unknown[]): void {
        if (shouldLog("debug")) {
            console.debug("[debug]", ...args);
        }
    },
    info(...args: unknown[]): void {
        if (shouldLog("info")) {
            console.log("[info]", ...args);
        }
    },
    warn(...args: unknown[]): void {
        if (shouldLog("warn")) {
            console.warn("[warn]", ...args);
        }
    },
    error(...args: unknown[]): void {
        if (shouldLog("error")) {
            console.error("[error]", ...args);
        }
    }
};
