import { getRedisClient } from "../redis/redis";

interface RateLimitConfig {
    /** Maximum number of requests allowed within the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
}

/**
 * Rate limits requests using a sliding window algorithm in Redis.
 * Uses a simple counter with TTL for each time window.
 *
 * @param key - Unique identifier for the rate limit (e.g., "domain:userId")
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redis = getRedisClient();
    const rateLimitKey = `ratelimit:${key}`;

    try {
        // Get current count
        const currentCount = (await redis.get<number>(rateLimitKey)) ?? 0;

        if (currentCount >= config.maxRequests) {
            // Get TTL to report when the limit resets
            const ttl = await redis.ttl(rateLimitKey);
            return {
                allowed: false,
                remaining: 0,
                resetInSeconds: ttl > 0 ? ttl : config.windowSeconds
            };
        }

        // Increment counter
        const newCount = await redis.incr(rateLimitKey);

        // Set TTL on first request in window
        if (newCount === 1) {
            await redis.expire(rateLimitKey, config.windowSeconds);
        }

        const ttl = await redis.ttl(rateLimitKey);

        return {
            allowed: true,
            remaining: Math.max(0, config.maxRequests - newCount),
            resetInSeconds: ttl > 0 ? ttl : config.windowSeconds
        };
    } catch (error) {
        // If Redis fails, allow the request but log the error
        console.error("[RateLimit] Redis error, allowing request:", error);
        return {
            allowed: true,
            remaining: config.maxRequests,
            resetInSeconds: config.windowSeconds
        };
    }
}

/**
 * Pre-configured rate limit for domain operations.
 * Allows 10 domain operations per minute per user/org combination.
 */
export const DOMAIN_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 10,
    windowSeconds: 60
};

/**
 * Pre-configured rate limit for DNS verification attempts.
 * Allows 20 verification attempts per minute per user/org combination.
 */
export const DNS_VERIFICATION_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 20,
    windowSeconds: 60
};

/**
 * Pre-configured rate limit for PR creation.
 * Allows 5 PR creations per hour per user/org combination.
 */
export const PR_CREATION_RATE_LIMIT: RateLimitConfig = {
    maxRequests: 5,
    windowSeconds: 3600
};

export class RateLimitError extends Error {
    resetInSeconds: number;

    constructor(message: string, resetInSeconds: number) {
        super(message);
        this.name = "RateLimitError";
        this.resetInSeconds = resetInSeconds;
    }
}

/**
 * Helper to check rate limit and throw if exceeded
 */
export async function assertRateLimit(identifier: string, operation: string, config: RateLimitConfig): Promise<void> {
    const key = `${operation}:${identifier}`;
    const result = await checkRateLimit(key, config);

    if (!result.allowed) {
        throw new RateLimitError(
            `Rate limit exceeded for ${operation}. Try again in ${result.resetInSeconds} seconds.`,
            result.resetInSeconds
        );
    }
}
