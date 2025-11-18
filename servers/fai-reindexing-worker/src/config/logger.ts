import winston from "winston";

/**
 * Winston logger configuration for the reindexing worker
 */
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: "fai-reindexing-worker"
    },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, service, domain, ...meta }) => {
                    const domainPrefix = domain ? `[${domain}] ` : "";
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
                    return `${timestamp} [${service}] ${level}: ${domainPrefix}${message}${metaStr}`;
                })
            )
        })
    ]
});

/**
 * Create a domain-scoped logger for better context tracking
 */
export function createDomainLogger(domain: string) {
    return logger.child({ domain });
}
