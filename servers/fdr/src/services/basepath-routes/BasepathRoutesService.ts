import { Redis } from "@upstash/redis";
import type winston from "winston";

const BASEPATH_ROUTES_KEY_PREFIX = "basepath-routes";

export interface BasepathRoutesService {
    addBasepathRoute(params: { hostname: string; basepath: string }): Promise<void>;
    removeBasepathRoute(params: { hostname: string; basepath: string }): Promise<void>;
    getBasepathRoutes(hostname: string): Promise<string[]>;
}

export class UpstashBasepathRoutesService implements BasepathRoutesService {
    private redis: Redis;
    private logger: winston.Logger;

    constructor({ logger }: { logger: winston.Logger }) {
        const url = process.env.KV_REST_API_URL;
        const token = process.env.KV_REST_API_TOKEN;

        if (!url || !token) {
            throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be set for BasepathRoutesService");
        }

        this.redis = new Redis({ url, token });
        this.logger = logger;
    }

    async addBasepathRoute({ hostname, basepath }: { hostname: string; basepath: string }): Promise<void> {
        const key = `${BASEPATH_ROUTES_KEY_PREFIX}:${hostname}`;
        try {
            await this.redis.hset(key, { [basepath]: true });
            this.logger.info(`[BasepathRoutes] Added basepath route: ${hostname} -> ${basepath}`);
        } catch (error) {
            this.logger.error(`[BasepathRoutes] Failed to add basepath route: ${hostname} -> ${basepath}`, error);
            throw error;
        }
    }

    async removeBasepathRoute({ hostname, basepath }: { hostname: string; basepath: string }): Promise<void> {
        const key = `${BASEPATH_ROUTES_KEY_PREFIX}:${hostname}`;
        try {
            await this.redis.hdel(key, basepath);
            this.logger.info(`[BasepathRoutes] Removed basepath route: ${hostname} -> ${basepath}`);
        } catch (error) {
            this.logger.error(`[BasepathRoutes] Failed to remove basepath route: ${hostname} -> ${basepath}`, error);
            throw error;
        }
    }

    async getBasepathRoutes(hostname: string): Promise<string[]> {
        const key = `${BASEPATH_ROUTES_KEY_PREFIX}:${hostname}`;
        try {
            const routes = await this.redis.hkeys(key);
            return routes;
        } catch (error) {
            this.logger.error(`[BasepathRoutes] Failed to get basepath routes for ${hostname}`, error);
            return [];
        }
    }
}

export class NoOpBasepathRoutesService implements BasepathRoutesService {
    async addBasepathRoute(_params: { hostname: string; basepath: string }): Promise<void> {}
    async removeBasepathRoute(_params: { hostname: string; basepath: string }): Promise<void> {}
    async getBasepathRoutes(_hostname: string): Promise<string[]> {
        return [];
    }
}
