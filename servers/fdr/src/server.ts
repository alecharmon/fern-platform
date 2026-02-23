import compress from "@fastify/compress";
import cors from "@fastify/cors";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { onError } from "@orpc/server";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { Agent, setGlobalDispatcher } from "undici";
import { getConfig } from "./app";
import { createFdrApplication } from "./app/FdrApplication";
import { createReadApiRouter } from "./controllers/api/getApiReadRouter";
import { createRegisterApiRouter } from "./controllers/api/getRegisterApiRouter";
import { createGetApiLatestRouter } from "./controllers/api/latest/getApiLatestRouter";
import { createDashboardRouter } from "./controllers/dashboard/getDashboardRouter";
import { createDocsV1ReadRouter } from "./controllers/docs/v1/getDocsReadService";
import { createDocsV1WriteRouter } from "./controllers/docs/v1/getDocsWriteService";
import { createDocsV2ReadRouter } from "./controllers/docs/v2/getDocsReadV2Service";
import { createDocsV2WriteRouter } from "./controllers/docs/v2/getDocsWriteV2Service";
import { createLibraryDocsRouter } from "./controllers/docs/v2/getLibraryDocsRouter";
import { createGetOrganizationForUrlRouter } from "./controllers/docs/v2/getOrganizationForUrlRouter";
import { createDocsCacheRouter } from "./controllers/docs-cache/docsCacheRouter";
import { createDocsDeploymentRouter } from "./controllers/docs-deployment";
import { createCliRouter } from "./controllers/generators/cliRouter";
import { createGeneratorsRootRouter } from "./controllers/generators/generatorsRootRouter";
import { createGeneratorVersionsRouter } from "./controllers/generators/generatorVersionsRouter";
import { createGitRouter } from "./controllers/git/gitRouter";
import { createPdfExportRouter } from "./controllers/pdf-export";
import { createComputeSemanticVersionRouter } from "./controllers/sdk/computeSemanticVersionRouter";
import { createSnippetsForSdkRouter } from "./controllers/snippets/createSnippetsForSdkRouter";
import { createTemplatesRouter } from "./controllers/snippets/createTemplatesRouter";
import { createSnippetsRouter } from "./controllers/snippets/snippetsRouter";
import { createTokensRouter } from "./controllers/tokens/createTokensRouter";
import { checkRedis } from "./healthchecks/checkRedis";

const PORT = 8080;

const config = getConfig();

const fastifyApp = Fastify({
    bodyLimit: 100 * 1024 * 1024
});

setGlobalDispatcher(new Agent({ connect: { timeout: 5_000 } }));

const app = createFdrApplication(config);

void startServer();

async function startServer(): Promise<void> {
    try {
        await fastifyApp.register(cors);
        await fastifyApp.register(compress);

        fastifyApp.addContentTypeParser("*", (_request, _payload, done) => {
            done(null, undefined);
        });

        fastifyApp.get("/health", async (_req, reply) => {
            try {
                const cacheInitialized = app.docsDefinitionCache.isInitialized();
                if (!cacheInitialized) {
                    app.logger.error("The docs definition cache is not initilialized. Erroring the health check.");
                    return reply.status(500).send();
                }
                if (app.redisDatastore != null) {
                    const redisHealthCheckSuccessful = await checkRedis({
                        redis: app.redisDatastore
                    });
                    if (!redisHealthCheckSuccessful) {
                        app.logger.error("Records cannot be successfully written and read from redis");
                        return reply.status(500).send();
                    }
                }
                return reply.status(200).send("OK");
            } catch (e: unknown) {
                app.logger.error("Error in health check:", e);
                return reply.status(500).send();
            }
        });

        await app.initialize();

        const orgForUrlRouter = createGetOrganizationForUrlRouter(app);
        const dashboardRouter = createDashboardRouter(app);
        const pdfExportRouter = createPdfExportRouter(app);
        const docsDeploymentRouter = createDocsDeploymentRouter(app);
        const apiLatestRouter = createGetApiLatestRouter(app);
        const registerApiRouter = createRegisterApiRouter(app);
        const readApiRouter = createReadApiRouter(app);
        const docsV1ReadRouter = createDocsV1ReadRouter(app);
        const docsV1WriteRouter = createDocsV1WriteRouter(app);
        const docsV2ReadRouter = createDocsV2ReadRouter(app);
        const docsV2WriteRouter = createDocsV2WriteRouter(app);
        const orpcHandler = new OpenAPIHandler(
            {
                ...orgForUrlRouter,
                ...dashboardRouter,
                ...pdfExportRouter,
                ...apiLatestRouter,
                ...registerApiRouter,
                ...readApiRouter
            },
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

        const docsV2ReadHandler = new OpenAPIHandler(docsV2ReadRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsV2Read error:", error);
                })
            ]
        });

        const docsV2WriteHandler = new OpenAPIHandler(docsV2WriteRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsV2Write error:", error);
                })
            ]
        });

        const docsV1ReadHandler = new OpenAPIHandler(docsV1ReadRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsV1Read error:", error);
                })
            ]
        });

        const docsV1WriteHandler = new OpenAPIHandler(docsV1WriteRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsV1Write error:", error);
                })
            ]
        });

        const headersContext = (req: FastifyRequest) => ({ headers: req.headers });

        function mountOrpc(
            prefix: `/${string}`,
            handlers: Array<{
                handler: OpenAPIHandler<Record<string, unknown>>;
                getContext: (req: FastifyRequest) => Record<string, unknown>;
            }>
        ) {
            const routeHandler = async (req: FastifyRequest, reply: FastifyReply) => {
                for (const { handler, getContext } of handlers) {
                    const { matched } = await handler.handle(req, reply, {
                        prefix,
                        context: getContext(req)
                    });
                    if (matched) {
                        return;
                    }
                }
                reply.callNotFound();
            };
            fastifyApp.all(prefix as `/${string}`, routeHandler);
            fastifyApp.all(`${prefix}/*` as `/${string}`, routeHandler);
        }

        mountOrpc("/v2/registry/docs", [
            { handler: orpcHandler, getContext: headersContext },
            { handler: libraryDocsHandler, getContext: headersContext },
            { handler: docsV2ReadHandler, getContext: headersContext },
            { handler: docsV2WriteHandler, getContext: headersContext }
        ]);

        mountOrpc("/dashboard", [{ handler: orpcHandler, getContext: headersContext }]);

        const cliRouter = createCliRouter(app);
        const cliHandler = new OpenAPIHandler(cliRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC CLI error:", error);
                })
            ]
        });

        mountOrpc("/generators/cli", [{ handler: cliHandler, getContext: headersContext }]);

        const templatesRouter = createTemplatesRouter(app);
        const templatesHandler = new OpenAPIHandler(templatesRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC templates error:", error);
                })
            ]
        });

        mountOrpc("/snippet-template", [{ handler: templatesHandler, getContext: headersContext }]);

        const generatorsRootRouter = createGeneratorsRootRouter(app);
        const generatorsRootHandler = new OpenAPIHandler(generatorsRootRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC generators error:", error);
                })
            ]
        });

        const generatorVersionsRouter = createGeneratorVersionsRouter(app);
        const generatorVersionsHandler = new OpenAPIHandler(generatorVersionsRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC generatorVersions error:", error);
                })
            ]
        });

        mountOrpc("/generators/versions", [{ handler: generatorVersionsHandler, getContext: headersContext }]);

        const sdkVersionsRouter = createComputeSemanticVersionRouter(app);
        const sdkVersionsHandler = new OpenAPIHandler(sdkVersionsRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC computeSemanticVersion error:", error);
                })
            ]
        });

        mountOrpc("/sdks", [{ handler: sdkVersionsHandler, getContext: headersContext }]);

        const docsDeploymentHandler = new OpenAPIHandler(docsDeploymentRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsDeployment error:", error);
                })
            ]
        });

        mountOrpc("/docs-deployment", [{ handler: docsDeploymentHandler, getContext: headersContext }]);

        mountOrpc("/pdf-export", [{ handler: orpcHandler, getContext: headersContext }]);

        mountOrpc("/registry/api/latest", [{ handler: orpcHandler, getContext: headersContext }]);

        mountOrpc("/registry/api", [{ handler: orpcHandler, getContext: headersContext }]);

        const docsCacheRouter = createDocsCacheRouter(app);
        const docsCacheHandler = new OpenAPIHandler(docsCacheRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC docsCache error:", error);
                })
            ]
        });

        mountOrpc("/docs-cache", [{ handler: docsCacheHandler, getContext: headersContext }]);

        const gitRouter = createGitRouter(app);
        const gitHandler = new OpenAPIHandler(gitRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC git error:", error);
                })
            ]
        });

        mountOrpc("/generators/github", [{ handler: gitHandler, getContext: headersContext }]);

        const snippetsFactoryRouter = createSnippetsForSdkRouter(app);
        const snippetsFactoryHandler = new OpenAPIHandler(snippetsFactoryRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC createSnippetsForSdk error:", error);
                })
            ]
        });

        const tokensRouter = createTokensRouter(app);
        const tokensHandler = new OpenAPIHandler(tokensRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC tokens error:", error);
                })
            ]
        });

        mountOrpc("/tokens", [{ handler: tokensHandler, getContext: headersContext }]);

        const snippetsRouter = createSnippetsRouter(app);
        const snippetsHandler = new OpenAPIHandler(snippetsRouter, {
            interceptors: [
                onError((error) => {
                    app.logger.error("oRPC snippets error:", error);
                })
            ]
        });

        mountOrpc("/snippets", [
            { handler: snippetsFactoryHandler, getContext: headersContext },
            {
                handler: snippetsHandler,
                getContext: (req: FastifyRequest) => ({
                    headers: req.headers,
                    query: req.query as Record<string, string | undefined>
                })
            }
        ]);

        mountOrpc("/registry/docs", [
            { handler: docsV1ReadHandler, getContext: headersContext },
            { handler: docsV1WriteHandler, getContext: headersContext }
        ]);

        mountOrpc("/generators", [{ handler: generatorsRootHandler, getContext: headersContext }]);

        app.logger.info(`Listening for requests on port ${PORT}`);
        await fastifyApp.listen({ port: PORT, host: "0.0.0.0" });
    } catch (err) {
        app.logger.error("Failed to start server", err);
    }
}
