import compression from "compression";
import cors from "cors";
import express from "express";
import { Agent, setGlobalDispatcher } from "undici";

import { register } from "./api";
import { FdrApplication, getConfig } from "./app";
import { createFdrApplication } from "./app/FdrApplication";
import { getApiLatestService } from "./controllers/api/getApiLatestService";
import { getReadApiService } from "./controllers/api/getApiReadService";
import { getRegisterApiService } from "./controllers/api/getRegisterApiService";
import { getDashboardController } from "./controllers/dashboard/getDashboardController";
import { getApiDiffService } from "./controllers/diff/getApiDiffService";
import { getDocsCacheService } from "./controllers/docs-cache/getDocsCacheService";
import { getDocsReadService } from "./controllers/docs/v1/getDocsReadService";
import { getDocsWriteService } from "./controllers/docs/v1/getDocsWriteService";
import { getDocsReadV2Service } from "./controllers/docs/v2/getDocsReadV2Service";
import { getDocsWriteV2Service } from "./controllers/docs/v2/getDocsWriteV2Service";
import { getGeneratorsCliController } from "./controllers/generators/getGeneratorsCliController";
import { getGeneratorsRootController } from "./controllers/generators/getGeneratorsRootController";
import { getGeneratorsVersionsController } from "./controllers/generators/getGeneratorsVersionsController";
import { getGitController } from "./controllers/git/getGitController";
import { getVersionsService } from "./controllers/sdk/getVersionsService";
import { getSnippetsFactoryService } from "./controllers/snippets/getSnippetsFactoryService";
import { getSnippetsService } from "./controllers/snippets/getSnippetsService";
import { getTemplatesService } from "./controllers/snippets/getTemplatesService";
import { getTokensService } from "./controllers/tokens/getTokensService";
import { checkRedis } from "./healthchecks/checkRedis";

const PORT = 8080;

const config = getConfig();

const expressApp = express();
expressApp.disable("x-powered-by");

expressApp.use(cors());
expressApp.use(compression());

setGlobalDispatcher(new Agent({ connect: { timeout: 5_000 } }));

const app = createFdrApplication(config);

expressApp.get("/health", (_req, res) => {
    (async () => {
        const cacheInitialized = app.docsDefinitionCache.isInitialized();
        if (!cacheInitialized) {
            app.logger.error("The docs definition cache is not initilialized. Erroring the health check.");
            res.sendStatus(500);
            return;
        }
        if (app.redisDatastore != null) {
            const redisHealthCheckSuccessful = await checkRedis({
                redis: app.redisDatastore
            });
            if (!redisHealthCheckSuccessful) {
                app.logger.error("Records cannot be successfully written and read from redis");
                res.sendStatus(500);
                return;
            }
        }
        res.sendStatus(200);
    })().catch((e: unknown) => {
        app.logger.error("Error in health check:", e);
        res.sendStatus(500);
    });
});

void startServer();

async function startServer(): Promise<void> {
    try {
        await app.initialize();
        expressApp.use(express.json({ limit: "50mb" }));
        register(expressApp, {
            docs: {
                v1: {
                    read: {
                        _root: getDocsReadService(app)
                    },
                    write: {
                        _root: getDocsWriteService(app)
                    }
                },
                v2: {
                    read: {
                        _root: getDocsReadV2Service(app)
                    },
                    write: {
                        _root: getDocsWriteV2Service(app)
                    }
                }
            },
            api: {
                v1: {
                    read: {
                        _root: getReadApiService(app)
                    },
                    register: {
                        _root: getRegisterApiService(app)
                    }
                },
                latest: {
                    _root: getApiLatestService(app)
                }
            },
            snippets: getSnippetsService(app),
            snippetsFactory: getSnippetsFactoryService(app),
            templates: getTemplatesService(app),
            diff: getApiDiffService(app),
            docsCache: getDocsCacheService(app),
            sdks: {
                versions: getVersionsService(app)
            },
            generators: {
                _root: getGeneratorsRootController(app),
                cli: getGeneratorsCliController(app),
                versions: getGeneratorsVersionsController(app)
            },
            tokens: getTokensService(app),
            git: getGitController(app),
            dashboard: {
                _root: getDashboardController(app)
            }
        });
        app.logger.info(`Listening for requests on port ${PORT}`);
        expressApp.listen(PORT);
    } catch (err) {
        app.logger.error("Failed to start express server", err);
    }
}
