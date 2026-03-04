import type { APIV1Db, FdrAPI } from "@fern-api/fdr-sdk";
import type { PrismaClient } from "@prisma/client";

import { readBufferAsync } from "../../util";

export interface APIDefinitionDao {
    getOrgIdForApiDefinition(apiDefinitionId: string): Promise<string | undefined>;

    loadAPIDefinition(apiDefinitionId: string): Promise<APIV1Db.DbApiDefinition | undefined>;

    loadAPILatestDefinition(apiDefinitionId: string): Promise<FdrAPI.api.latest.ApiDefinition | undefined>;

    loadAPIDefinitions(apiDefinitionIds: string[]): Promise<Record<string, APIV1Db.DbApiDefinition>>;
}

export class APIDefinitionDaoImpl implements APIDefinitionDao {
    constructor(private readonly prisma: PrismaClient) {}

    public async getOrgIdForApiDefinition(apiDefinitionId: string): Promise<string | undefined> {
        const apiDefinition = await this.prisma.apiDefinitionsV2.findFirst({
            where: {
                apiDefinitionId
            },
            select: {
                orgId: true
            }
        });
        return apiDefinition?.orgId;
    }

    public async loadAPIDefinition(apiDefinitionId: string): Promise<APIV1Db.DbApiDefinition | undefined> {
        const apiDefinition = await this.prisma.apiDefinitionsV2.findFirst({
            where: {
                apiDefinitionId
            },
            select: {
                definition: true
            }
        });
        if (apiDefinition == null) {
            return undefined;
        }
        return stripNulls(await readBufferAsync(apiDefinition.definition)) as APIV1Db.DbApiDefinition;
    }

    public async loadAPILatestDefinition(
        apiDefinitionId: string
    ): Promise<FdrAPI.api.latest.ApiDefinition | undefined> {
        const apiDefinition = await this.prisma.apiDefinitionsLatest.findFirst({
            where: {
                apiDefinitionId
            },
            select: {
                definition: true
            }
        });
        if (apiDefinition == null) {
            return undefined;
        }
        return stripNulls(await readBufferAsync(apiDefinition.definition)) as FdrAPI.api.latest.ApiDefinition;
    }

    public async loadAPIDefinitions(apiDefinitionIds: string[]): Promise<Record<string, APIV1Db.DbApiDefinition>> {
        const apiDefinitions = await this.prisma.apiDefinitionsV2.findMany({
            where: {
                apiDefinitionId: {
                    in: Array.from(apiDefinitionIds)
                }
            },
            select: {
                apiDefinitionId: true,
                definition: true
            }
        });
        const entries = await Promise.all(
            apiDefinitions.map(async (apiDefinition) => {
                const definition = stripNulls(
                    await readBufferAsync(apiDefinition.definition)
                ) as APIV1Db.DbApiDefinition;
                return [apiDefinition.apiDefinitionId, definition] as const;
            })
        );
        return Object.fromEntries(entries);
    }
}

function stripNulls<T>(obj: T): T {
    if (obj === null) {
        return undefined as T;
    }
    if (Array.isArray(obj)) {
        return obj.map(stripNulls) as T;
    }
    if (typeof obj === "object" && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj)
                .map(([k, v]) => [k, stripNulls(v)])
                .filter(([, v]) => v !== undefined)
        ) as T;
    }
    return obj;
}
