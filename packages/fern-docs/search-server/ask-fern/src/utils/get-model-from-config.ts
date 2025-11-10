import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createCohere } from "@ai-sdk/cohere";
import { anthropicApiKey, cohereApiKey } from "@fern-api/docs-server/env-variables";
import type { LanguageModel } from "ai";
import { createFallback } from "ai-fallback";

type ModelId = "claude-3.7" | "claude-4" | "claude-4.5" | "claude-4.5-haiku";
export type ModelProvider = "cohere" | "bedrock" | "anthropic";

type ModelConfig = {
    modelId: string;
    region: string;
};

type AnthropicModelConfig = {
    modelId: string;
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
    },
    "claude-4.5-haiku": {
        modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
        region: "us-east-1"
    }
};

/**
 * Direct Anthropic API model IDs for structured output use cases.
 * Bedrock doesn't support tool mode properly for structured outputs,
 * so we use direct Anthropic API which provides native support.
 */
const ANTHROPIC_MODEL_CONFIGS: Record<ModelId, AnthropicModelConfig> = {
    "claude-3.7": {
        modelId: "claude-3-7-sonnet-20250219"
    },
    "claude-4": {
        modelId: "claude-sonnet-4-20250514"
    },
    "claude-4.5": {
        modelId: "claude-sonnet-4-5-20250929"
    },
    "claude-4.5-haiku": {
        modelId: "claude-haiku-4-5-20251001"
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

// For structured output, use direct Anthropic API (no fallback)
function getModelForStructuredOutput(requested: ModelId): {
    model: LanguageModel;
    provider: ModelProvider;
} {
    const anthropic = createAnthropic({ apiKey: anthropicApiKey() });
    const cfg = ANTHROPIC_MODEL_CONFIGS[requested];
    if (!cfg) {
        throw new Error(
            `Model ${requested} not configured for structured output. Available models: ${Object.keys(ANTHROPIC_MODEL_CONFIGS).join(", ")}`
        );
    }
    return {
        model: anthropic(cfg.modelId),
        provider: "anthropic"
    };
}

export function getLanguageModel(
    model: string | undefined,
    options?: { forStructuredOutput?: boolean }
): {
    model: LanguageModel;
    provider: ModelProvider;
} {
    if (model === "command-a" || model === "command-r-plus") {
        // TODO: remove command-r-plus once fern generate change is resolved
        const cohere = createCohere({ apiKey: cohereApiKey() });
        return { model: cohere("command-a-03-2025"), provider: "cohere" };
    }

    const requested = resolveModelId(model);

    if (options?.forStructuredOutput) {
        return getModelForStructuredOutput(requested);
    }

    // For regular chat/streaming, use Bedrock with fallbacks
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
