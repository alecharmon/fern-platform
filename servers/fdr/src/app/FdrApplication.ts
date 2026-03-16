import { PrismaClient } from "@prisma/client";
import winston from "winston";

import { FdrDao } from "../db";
import { type AuthService, AuthServiceImpl } from "../services/auth";
import { LocalAuthServiceImpl } from "../services/auth/LocalAuthService";
import {
    type BasepathRoutesService,
    NoOpBasepathRoutesService,
    UpstashBasepathRoutesService
} from "../services/basepath-routes";
import { type DatabaseService, DatabaseServiceImpl } from "../services/db";
import { type DocsDefinitionCache, DocsDefinitionCacheImpl } from "../services/docs-cache/DocsDefinitionCache";
import RedisDocsDefinitionStore from "../services/docs-cache/RedisDocsDefinitionStore";
import {
    type DomainSettingsService,
    NoOpDomainSettingsService,
    UpstashDomainSettingsService
} from "../services/domain-settings";
import { createFdrEntitlementsChecker, type EntitlementsChecker } from "../services/entitlements";
import { type LibraryDocsService, LibraryDocsServiceImpl } from "../services/library-docs";
import { type PdfExportService, PdfExportServiceImpl } from "../services/pdf-export";
import { createPosthogService, NoOpPosthogService, type PosthogService } from "../services/posthog";
import { LocalRevalidatorServiceImpl } from "../services/revalidator/LocalRevalidatorService";
import { type RevalidatorService, RevalidatorServiceImpl } from "../services/revalidator/RevalidatorService";
import { type S3Service, S3ServiceImpl } from "../services/s3";
import { LocalSlackServiceImpl } from "../services/slack/LocalSlackService";
import { type SlackService, SlackServiceImpl } from "../services/slack/SlackService";
import type { FdrConfig } from "./FdrConfig";
import { LOGGER } from "./logger";

export interface FdrServices {
    readonly auth: AuthService;
    readonly db: DatabaseService;
    readonly s3: S3Service;
    readonly slack: SlackService;
    readonly revalidator: RevalidatorService;
    readonly libraryDocs: LibraryDocsService;
    readonly pdfExport: PdfExportService;
    readonly basepathRoutes: BasepathRoutesService;
    readonly domainSettings: DomainSettingsService;
    readonly posthog: PosthogService;
}

export { LOGGER };

export class FdrApplication {
    public readonly services: FdrServices;
    public readonly dao: FdrDao;
    public readonly docsDefinitionCache: DocsDefinitionCache;
    public readonly entitlements: EntitlementsChecker | null;
    public readonly logger = LOGGER;
    public readonly redisDatastore;

    public constructor(
        public readonly config: FdrConfig,
        services?: Partial<FdrServices>
    ) {
        const separator = "========================================";
        const prettyJsonWithBars = winston.format.printf((info) => {
            return `${separator}\n${JSON.stringify(info, null, 2)}\n${separator}`;
        });

        this.logger = winston.createLogger({
            level: config.logLevel,
            format: prettyJsonWithBars,
            transports: [
                new winston.transports.Console({
                    format: prettyJsonWithBars
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
            revalidator: services?.revalidator ?? new RevalidatorServiceImpl(),
            libraryDocs: services?.libraryDocs ?? new LibraryDocsServiceImpl(this),
            pdfExport: services?.pdfExport ?? new PdfExportServiceImpl(this),
            basepathRoutes: services?.basepathRoutes ?? this.createBasepathRoutesService(),
            domainSettings: services?.domainSettings ?? this.createDomainSettingsService(),
            posthog: services?.posthog ?? createPosthogService()
        };

        this.dao = new FdrDao(prisma);

        this.entitlements = config.entitlementsEnabled ? createFdrEntitlementsChecker(prisma) : null;

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

    private createBasepathRoutesService(): BasepathRoutesService {
        if (this.config.localModeOverride) {
            return new NoOpBasepathRoutesService();
        }
        try {
            return new UpstashBasepathRoutesService({ logger: this.logger });
        } catch {
            this.logger.warn("[FdrApplication] Failed to create UpstashBasepathRoutesService, using no-op");
            return new NoOpBasepathRoutesService();
        }
    }

    private createDomainSettingsService(): DomainSettingsService {
        if (this.config.localModeOverride) {
            return new NoOpDomainSettingsService();
        }
        try {
            return new UpstashDomainSettingsService({ logger: this.logger });
        } catch {
            this.logger.warn("[FdrApplication] Failed to create UpstashDomainSettingsService, using no-op");
            return new NoOpDomainSettingsService();
        }
    }

    public async initialize(): Promise<void> {
        await this.docsDefinitionCache.initialize();
    }
}

export function createFdrApplication(config: FdrConfig): FdrApplication {
    if (config.localModeOverride) {
        return new FdrApplication(config, {
            // When VENUS_URL is configured, use real AuthServiceImpl (talks to Venus);
            // otherwise fall back to the local stub that permits everything.
            auth: config.venusUrl
                ? undefined // will default to AuthServiceImpl(this) inside constructor
                : new LocalAuthServiceImpl({ orgIds: [] }),
            slack: new LocalSlackServiceImpl(),
            revalidator: new LocalRevalidatorServiceImpl(),
            posthog: new NoOpPosthogService()
        });
    }

    return new FdrApplication(config);
}
