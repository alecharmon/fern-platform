import type { inferCachedData, RedisCacheKey, RedisCacheKeyType } from "./cacheKey";
import { redisDel, redisGet, redisSet } from "./redis";

export class AsyncRedisCache<T extends RedisCacheKeyType> {
    private debug: boolean;
    private ttlInSeconds: number;
    private inFlightRequests: Map<string, Promise<inferCachedData<T>>> = new Map();

    constructor(
        private readonly type: T,
        { ttlInSeconds, debug = false }: { ttlInSeconds: number; debug?: boolean }
    ) {
        this.ttlInSeconds = ttlInSeconds;
        this.debug = debug;
    }

    public async get(key: RedisCacheKey<T>, getter: () => Promise<inferCachedData<T>>): Promise<inferCachedData<T>> {
        const log = this.debug
            ? (logLine: string) => console.debug(`[${this.type} CACHE] key=${key} ${logLine}`)
            : undefined;

        log?.("checking cache");

        const cachedValue = await redisGet(key);
        if (cachedValue != null) {
            log?.("cache hit, returning value");
            return cachedValue;
        }

        const existingRequest = this.inFlightRequests.get(key);
        if (existingRequest != null) {
            log?.("request already in flight, waiting for result");
            return await existingRequest;
        }

        log?.("cache miss, getting value");
        const requestPromise = (async () => {
            try {
                const newValue = await getter();

                log?.("updating cache");
                await redisSet(key, newValue, {
                    ttlInSeconds: this.ttlInSeconds
                });

                log?.("returning value");
                return newValue;
            } finally {
                this.inFlightRequests.delete(key);
            }
        })();

        this.inFlightRequests.set(key, requestPromise);
        return await requestPromise;
    }

    public async set(key: RedisCacheKey<T>, value: inferCachedData<T>): Promise<void> {
        await redisSet(key, value, {
            ttlInSeconds: this.ttlInSeconds
        });
    }

    public async getDirectly(key: RedisCacheKey<T>): Promise<inferCachedData<T> | undefined> {
        return await redisGet(key);
    }

    public async invalidate(key: RedisCacheKey<T>) {
        await redisDel(key);
    }
}
