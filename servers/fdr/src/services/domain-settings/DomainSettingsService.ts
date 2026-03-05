import { Redis } from "@upstash/redis";
import type winston from "winston";

const DOMAIN_SETTINGS_KEY_PREFIX = "domain-settings";

export interface DomainSettings {
    defaultBasepath?: string;
}

export interface DomainSettingsService {
    setDomainSettings(params: { hostname: string; settings: Partial<DomainSettings> }): Promise<void>;
    getDomainSettings(params: { hostname: string }): Promise<DomainSettings | undefined>;
}

export class UpstashDomainSettingsService implements DomainSettingsService {
    private redis: Redis;
    private logger: winston.Logger;

    constructor({ logger }: { logger: winston.Logger }) {
        const url = process.env.KV_REST_API_URL;
        const token = process.env.KV_REST_API_TOKEN;

        if (!url || !token) {
            throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN must be set for DomainSettingsService");
        }

        this.redis = new Redis({ url, token });
        this.logger = logger;
    }

    async setDomainSettings({
        hostname,
        settings
    }: {
        hostname: string;
        settings: Partial<DomainSettings>;
    }): Promise<void> {
        const key = `${DOMAIN_SETTINGS_KEY_PREFIX}:${hostname}`;
        try {
            await this.redis.hset(key, settings);
            this.logger.info(`[DomainSettings] Set domain settings for ${hostname}: ${JSON.stringify(settings)}`);
        } catch (error) {
            this.logger.error(`[DomainSettings] Failed to set domain settings for ${hostname}`, error);
            throw error;
        }
    }

    async getDomainSettings({ hostname }: { hostname: string }): Promise<DomainSettings | undefined> {
        const key = `${DOMAIN_SETTINGS_KEY_PREFIX}:${hostname}`;
        try {
            const settings = await this.redis.hgetall(key);
            if (settings == null || Object.keys(settings).length === 0) {
                return undefined;
            }
            return settings as DomainSettings;
        } catch (error) {
            this.logger.error(`[DomainSettings] Failed to get domain settings for ${hostname}`, error);
            return undefined;
        }
    }
}

export class NoOpDomainSettingsService implements DomainSettingsService {
    async setDomainSettings(_params: { hostname: string; settings: Partial<DomainSettings> }): Promise<void> {}
    async getDomainSettings(_params: { hostname: string }): Promise<DomainSettings | undefined> {
        return undefined;
    }
}
