import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createCohere } from "@ai-sdk/cohere";
import { anthropicApiKey, cohereApiKey } from "@fern-api/docs-server/env-variables";
import type { LanguageModel } from "ai";
import { createFallback } from "ai-fallback";

type ModelId = "claude-3.7" | "claude-4" | "claude-4.5";
export type ModelProvider = "cohere" | "bedrock";

type ModelConfig = {
    modelId: string;
    region: string;
};

const MODEL_CONFIGS: Record<ModelId, ModelConfig> = {
    "claude-3.7": {
        modelId: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
        region: "us-east-1"
    },
    "claude-4": {
        modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
        region: "us-east-1"
    },
    "claude-4.5": {
        modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        region: "us-east-1"
    }
};

const DEFAULT_MODEL: ModelId = "claude-3.7";

const FALLBACK_ORDER: ModelId[] = ["claude-4.5", "claude-4", "claude-3.7"];

const bedrockByRegion: Record<string, ReturnType<typeof createAmazonBedrock>> = {};
function getBedrock(region: string) {
    if (!bedrockByRegion[region]) {
        bedrockByRegion[region] = createAmazonBedrock({
            region,
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
    }
    return bedrockByRegion[region];
}

function resolveModelId(model: string | undefined): ModelId {
    const m = (model ?? DEFAULT_MODEL) as ModelId;
    return (Object.keys(MODEL_CONFIGS) as ModelId[]).includes(m) ? m : DEFAULT_MODEL;
}

function buildOrderedModels(primary: ModelId): ModelId[] {
    return [primary, ...FALLBACK_ORDER.filter((m) => m !== primary)];
}

export function getLanguageModel(model: string | undefined): {
    model: LanguageModel;
    provider: ModelProvider;
} {
    if (model === "command-a" || model === "command-r-plus") {
        // TODO: remove command-r-plus once fern generate change is resolved
        const cohere = createCohere({ apiKey: cohereApiKey() });
        return { model: cohere("command-a-03-2025"), provider: "cohere" };
    }

    const requested = resolveModelId(model);
    const ordered = buildOrderedModels(requested);

    const bedrockModels = ordered.map((id) => {
        const cfg = MODEL_CONFIGS[id];
        const bedrock = getBedrock(cfg.region);
        return bedrock(cfg.modelId);
    });

    const anthropic = createAnthropic({ apiKey: anthropicApiKey() });
    const anthropicFinal = anthropic("claude-3-7-sonnet-20250219");

    return {
        model: createFallback({
            models: [...bedrockModels, anthropicFinal]
        }),
        provider: "bedrock"
    };
}
