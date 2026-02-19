import { OpenAPIHandler } from "@orpc/openapi/node";
import { onError } from "@orpc/server";
import compression from "compression";
import cors from "cors";
import express from "express";
import { Agent, setGlobalDispatcher } from "undici";
import { register } from "./api";
import { getConfig } from "./app";
import { createFdrApplication } from "./app/FdrApplication";
import { getApiLatestService } from "./controllers/api/getApiLatestService";
import { getReadApiService } from "./controllers/api/getApiReadService";
import { getRegisterApiService } from "./controllers/api/getRegisterApiService";
import { createDashboardRouter } from "./controllers/dashboard/getDashboardRouter";
import { getDocsReadService } from "./controllers/docs/v1/getDocsReadService";
import { getDocsWriteService } from "./controllers/docs/v1/getDocsWriteService";
import { getDocsReadV2Service } from "./controllers/docs/v2/getDocsReadV2Service";
import { getDocsWriteV2Service } from "./controllers/docs/v2/getDocsWriteV2Service";
import { createLibraryDocsRouter } from "./controllers/docs/v2/getLibraryDocsRouter";
import { createGetOrganizationForUrlRouter } from "./controllers/docs/v2/getOrganizationForUrlRouter";
import { createDocsCacheRouter } from "./controllers/docs-cache/docsCacheRouter";
import { createCliRouter } from "./controllers/generators/cliRouter";
import { createGeneratorVersionsRouter } from "./controllers/generators/generatorVersionsRouter";
import { getGeneratorsRootController } from "./controllers/generators/getGeneratorsRootController";
import { createGitRouter } from "./controllers/git/gitRouter";
import { createPdfExportRouter } from "./controllers/pdf-export";
import { createComputeSemanticVersionRouter } from "./controllers/sdk/computeSemanticVersionRouter";
import { createSnippetsForSdkRouter } from "./controllers/snippets/createSnippetsForSdkRouter";
import { createTemplatesRouter } from "./controllers/snippets/createTemplatesRouter";
import { getSnippetsService } from "./controllers/snippets/getSnippetsService";
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

        const orgForUrlRouter = createGetOrganizationForUrlRouter(app);
        const dashboardRouter = createDashboardRouter(app);
        const pdfExportRouter = createPdfExportRouter(app);
        const orpcHandler = new OpenAPIHandler(
            { ...orgForUrlRouter, ...dashboardRouter, ...pdfExportRouter },
            {
                interceptors: [
                    onError((error) => {
                        app.logger.error("oRPC error:", error);
                    })
                ]
            }
        );

        const libraryDocsRouter = createLibraryDocsRouter(app);
        const libraryDocsHandler = new OpenAPIHandler(libraryDocsRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC libraryDocs error:", error);
                })
            ]
        });

        expressApp.use("/v2/registry/docs", async (req, res, next) => {
            const { matched: orgMatched } = await orpcHandler.handle(req, res, {
                prefix: "/v2/registry/docs",
                context: { headers: req.headers }
            });
            if (orgMatched) {
                return;
            }
            const { matched: libDocsMatched } = await libraryDocsHandler.handle(req, res, {
                prefix: "/v2/registry/docs",
                context: { headers: req.headers }
            });
            if (libDocsMatched) {
                return;
            }
            next();
        });

        expressApp.use("/dashboard", async (req, res, next) => {
            const { matched } = await orpcHandler.handle(req, res, {
                prefix: "/dashboard",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const cliRouter = createCliRouter(app);
        const cliHandler = new OpenAPIHandler(cliRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC CLI error:", error);
                })
            ]
        });

        expressApp.use("/generators/cli", async (req, res, next) => {
            const { matched } = await cliHandler.handle(req, res, {
                prefix: "/generators/cli",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const templatesRouter = createTemplatesRouter(app);
        const templatesHandler = new OpenAPIHandler(templatesRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC templates error:", error);
                })
            ]
        });

        expressApp.use("/snippet-template", async (req, res, next) => {
            const { matched } = await templatesHandler.handle(req, res, {
                prefix: "/snippet-template",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const generatorVersionsRouter = createGeneratorVersionsRouter(app);
        const generatorVersionsHandler = new OpenAPIHandler(generatorVersionsRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC generatorVersions error:", error);
                })
            ]
        });

        expressApp.use("/generators/versions", async (req, res, next) => {
            const { matched } = await generatorVersionsHandler.handle(req, res, {
                prefix: "/generators/versions",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const sdkVersionsRouter = createComputeSemanticVersionRouter(app);
        const sdkVersionsHandler = new OpenAPIHandler(sdkVersionsRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC computeSemanticVersion error:", error);
                })
            ]
        });

        expressApp.use("/sdks", async (req, res, next) => {
            const { matched } = await sdkVersionsHandler.handle(req, res, {
                prefix: "/sdks",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        expressApp.use("/pdf-export", async (req, res, next) => {
            const { matched } = await orpcHandler.handle(req, res, {
                prefix: "/pdf-export",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const docsCacheRouter = createDocsCacheRouter(app);
        const docsCacheHandler = new OpenAPIHandler(docsCacheRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsCache error:", error);
                })
            ]
        });

        expressApp.use("/docs-cache", async (req, res, next) => {
            const { matched } = await docsCacheHandler.handle(req, res, {
                prefix: "/docs-cache",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const gitRouter = createGitRouter(app);
        const gitHandler = new OpenAPIHandler(gitRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC git error:", error);
                })
            ]
        });

        expressApp.use("/generators/github", async (req, res, next) => {
            const { matched } = await gitHandler.handle(req, res, {
                prefix: "/generators/github",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        const snippetsFactoryRouter = createSnippetsForSdkRouter(app);
        const snippetsFactoryHandler = new OpenAPIHandler(snippetsFactoryRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC createSnippetsForSdk error:", error);
                })
            ]
        });

        expressApp.use("/snippets", async (req, res, next) => {
            const { matched } = await snippetsFactoryHandler.handle(req, res, {
                prefix: "/snippets",
                context: { headers: req.headers }
            });
            if (matched) {
                return;
            }
            next();
        });

        expressApp.use(express.json({ limit: "100mb" }));
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
            generators: {
                _root: getGeneratorsRootController(app)
            },
            tokens: getTokensService(app)
        });
        app.logger.info(`Listening for requests on port ${PORT}`);
        expressApp.listen(PORT);
    } catch (err) {
        app.logger.error("Failed to start express server", err);
    }
}
