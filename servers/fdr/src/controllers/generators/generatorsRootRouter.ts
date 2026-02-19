import { os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import {
    GeneratorId,
    GeneratorLanguageSchema,
    GeneratorSchema,
    GeneratorScriptsSchema,
    GeneratorTypeSchema
} from "./types";

const GeneratorOutputSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    generatorType: GeneratorTypeSchema,
    generatorLanguage: GeneratorLanguageSchema.optional(),
    dockerImage: z.string(),
    scripts: GeneratorScriptsSchema.optional()
});

export function createGeneratorsRootRouter(app: FdrApplication) {
    const upsertGenerator = os
        .route({ method: "PUT", path: "/" })
        .input(GeneratorSchema)
        .output(z.void())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            await app.dao.generators().upsertGenerator({
                generator: {
                    id: GeneratorId(input.id),
                    displayName: input.displayName,
                    generatorType: input.generatorType,
                    generatorLanguage: input.generatorLanguage,
                    dockerImage: input.dockerImage,
                    scripts:
                        input.scripts != null
                            ? {
                                  preInstallScript: input.scripts.preInstallScript,
                                  installScript: input.scripts.installScript,
                                  compileScript: input.scripts.compileScript,
                                  testScript: input.scripts.testScript
                              }
                            : undefined
                }
            });
        });

    const getGeneratorByImage = os
        .route({ method: "POST", path: "/by-image" })
        .input(z.object({ dockerImage: z.string() }))
        .output(GeneratorOutputSchema.optional())
        .handler(async ({ input }) => {
            const generator = await app.dao.generators().getGeneratorByImage({ image: input.dockerImage });
            if (generator == null) {
                return undefined;
            }
            return {
                ...generator,
                id: generator.id as string,
                generatorLanguage: generator.generatorLanguage ?? undefined
            };
        });

    const getGenerator = os
        .route({ method: "GET", path: "/{generatorId}" })
        .input(z.object({ generatorId: z.string() }))
        .output(GeneratorOutputSchema.optional())
        .handler(async ({ input }) => {
            const generator = await app.dao.generators().getGenerator({ generatorId: GeneratorId(input.generatorId) });
            if (generator == null) {
                return undefined;
            }
            return {
                ...generator,
                id: generator.id as string,
                generatorLanguage: generator.generatorLanguage ?? undefined
            };
        });

    const listGenerators = os
        .route({ method: "GET", path: "/" })
        .input(z.object({}))
        .output(z.array(GeneratorOutputSchema))
        .handler(async () => {
            const generators = await app.dao.generators().listGenerators();
            return generators.map((g) => ({
                ...g,
                id: g.id as string,
                generatorLanguage: g.generatorLanguage ?? undefined
            }));
        });

    return { upsertGenerator, getGeneratorByImage, getGenerator, listGenerators };
}
