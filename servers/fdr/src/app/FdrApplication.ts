import { PrismaClient } from "@prisma/client";
import winston from "winston";

import { FdrDao } from "../db";
import { type AuthService, AuthServiceImpl } from "../services/auth";
import { LocalAuthServiceImpl } from "../services/auth/LocalAuthService";
import { type DatabaseService, DatabaseServiceImpl } from "../services/db";
import { type DocsDefinitionCache, DocsDefinitionCacheImpl } from "../services/docs-cache/DocsDefinitionCache";
import RedisDocsDefinitionStore from "../services/docs-cache/RedisDocsDefinitionStore";
import { LocalRevalidatorServiceImpl } from "../services/revalidator/LocalRevalidatorService";
import { type RevalidatorService, RevalidatorServiceImpl } from "../services/revalidator/RevalidatorService";
import { type S3Service, S3ServiceImpl } from "../services/s3";
import { LocalSlackServiceImpl } from "../services/slack/LocalSlackService";
import { type SlackService, SlackServiceImpl } from "../services/slack/SlackService";
import type { FdrConfig } from "./FdrConfig";

export interface FdrServices {
    readonly auth: AuthService;
    readonly db: DatabaseService;
    readonly s3: S3Service;
    readonly slack: SlackService;
    readonly revalidator: RevalidatorService;
}

export const LOGGER = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.json()
        })
    ]
});

export class FdrApplication {
    public readonly services: FdrServices;
    public readonly dao: FdrDao;
    public readonly docsDefinitionCache: DocsDefinitionCache;
    public readonly logger = LOGGER;
    public readonly redisDatastore;

    public constructor(
        public readonly config: FdrConfig,
        services?: Partial<FdrServices>
    ) {
        this.logger = winston.createLogger({
            level: config.logLevel,
            format: winston.format.json(),
            transports: [
                new winston.transports.Console({
                    format: winston.format.json()
                })
            ]
        });
        const prisma = new PrismaClient({
            log: ["info", "warn", "error"],
            transactionOptions: {
                timeout: 15000,
                maxWait: 15000
            }
        });

        this.services = {
            auth: services?.auth ?? new AuthServiceImpl(this),
            db: services?.db ?? new DatabaseServiceImpl(prisma),
            s3: services?.s3 ?? new S3ServiceImpl(this.config, this),
            slack: services?.slack ?? new SlackServiceImpl(this),
            revalidator: services?.revalidator ?? new RevalidatorServiceImpl()
        };

        this.dao = new FdrDao(prisma);

        this.redisDatastore = config.redisEnabled
            ? new RedisDocsDefinitionStore({
                  cacheEndpointUrl: `redis://${this.config.docsCacheEndpoint}`,
                  clusterModeEnabled: config.redisClusteringEnabled
              })
            : undefined;

        this.docsDefinitionCache = new DocsDefinitionCacheImpl(this, this.dao, this.redisDatastore);

        if ("prepareStackTrace" in Error) {
            Error.prepareStackTrace = (err, stack) =>
                JSON.stringify({
                    message: err.message,
                    stack: stack.map((frame) => ({
                        file: frame.getFileName(),
                        function: frame.getFunctionName(),
                        column: frame.getColumnNumber(),
                        line: frame.getLineNumber()
                    }))
                });
        }
    }

    public async initialize(): Promise<void> {
        await this.docsDefinitionCache.initialize();
    }
}

export function createFdrApplication(config: FdrConfig): FdrApplication {
    if (config.localModeOverride) {
        return new FdrApplication(config, {
            auth: new LocalAuthServiceImpl({
                orgIds: []
            }),
            slack: new LocalSlackServiceImpl(),
            revalidator: new LocalRevalidatorServiceImpl()
        });
    }

    return new FdrApplication(config);
}
