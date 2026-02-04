import type { FdrAPI } from "@fern-api/fdr-sdk";
import type { GlobalOrgConfig, PrismaClient } from "@prisma/client";
import { readBuffer, writeBuffer } from "../../util";

export interface GlobalOrgConfigData {
    orgId: FdrAPI.OrgId;
    configId: string;
    config: GlobalOrgConfigContent;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * The content stored in the global org config.
 * This contains the shared configuration that can be referenced by multiple docs instances.
 */
export interface GlobalOrgConfigContent {
    // Navigation
    navbarLinks?: unknown;
    footerLinks?: unknown;

    // Logo
    logoHeight?: number;
    logoHref?: string;
    logoRightText?: string;
    favicon?: string;

    // Styles
    colorsV3?: unknown;
    layout?: unknown;
    theme?: unknown;
    typographyV2?: unknown;

    // Integrations
    analyticsConfig?: unknown;
    integrations?: unknown;

    // CSS and JS
    css?: unknown;
    js?: unknown;

    // AI Chat
    aiChatConfig?: unknown;

    // Custom components
    header?: string;
    footer?: string;
}

export interface CreateGlobalOrgConfigParams {
    orgId: string;
    configId?: string;
    config: GlobalOrgConfigContent;
}

export interface UpdateGlobalOrgConfigParams {
    orgId: string;
    configId: string;
    config: GlobalOrgConfigContent;
}

export interface GlobalOrgConfigDao {
    /**
     * Create or update a global org config.
     * If a config with the same orgId and configId exists, it will be updated.
     */
    upsertConfig(params: CreateGlobalOrgConfigParams): Promise<GlobalOrgConfigData>;

    /**
     * Get a global org config by orgId and configId.
     */
    getConfig(orgId: string, configId: string): Promise<GlobalOrgConfigData | null>;

    /**
     * Delete a global org config.
     */
    deleteConfig(orgId: string, configId: string): Promise<void>;

    /**
     * List all global org configs for an organization.
     */
    listConfigsForOrg(orgId: string): Promise<GlobalOrgConfigData[]>;
}

function mapDbToData(dbConfig: GlobalOrgConfig): GlobalOrgConfigData {
    return {
        orgId: dbConfig.orgId as FdrAPI.OrgId,
        configId: dbConfig.configId,
        config: readBuffer(dbConfig.config) as GlobalOrgConfigContent,
        createdAt: dbConfig.createdAt,
        updatedAt: dbConfig.updatedAt
    };
}

export class GlobalOrgConfigDaoImpl implements GlobalOrgConfigDao {
    constructor(private readonly prisma: PrismaClient) {}

    async upsertConfig(params: CreateGlobalOrgConfigParams): Promise<GlobalOrgConfigData> {
        const configId = params.configId ?? "default";
        const configBuffer = writeBuffer(params.config);

        const result = await this.prisma.globalOrgConfig.upsert({
            where: {
                orgId_configId: {
                    orgId: params.orgId,
                    configId
                }
            },
            create: {
                orgId: params.orgId,
                configId,
                config: configBuffer
            },
            update: {
                config: configBuffer
            }
        });

        return mapDbToData(result);
    }

    async getConfig(orgId: string, configId: string): Promise<GlobalOrgConfigData | null> {
        const result = await this.prisma.globalOrgConfig.findUnique({
            where: {
                orgId_configId: {
                    orgId,
                    configId
                }
            }
        });

        if (result == null) {
            return null;
        }

        return mapDbToData(result);
    }

    async deleteConfig(orgId: string, configId: string): Promise<void> {
        await this.prisma.globalOrgConfig.delete({
            where: {
                orgId_configId: {
                    orgId,
                    configId
                }
            }
        });
    }

    async listConfigsForOrg(orgId: string): Promise<GlobalOrgConfigData[]> {
        const results = await this.prisma.globalOrgConfig.findMany({
            where: { orgId },
            orderBy: { updatedAt: "desc" }
        });

        return results.map(mapDbToData);
    }
}
