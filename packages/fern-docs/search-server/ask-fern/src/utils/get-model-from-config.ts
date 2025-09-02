import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createCohere } from "@ai-sdk/cohere";
import { LanguageModel } from "ai";
import { createFallback } from "ai-fallback";

import {
  anthropicApiKey,
  cohereApiKey,
} from "@fern-api/docs-server/env-variables";

type ModelId = string;

export type ModelProvider = "anthropic" | "cohere" | "bedrock";

type ModelConfig = {
  modelId: string;
  region: string;
};

const CLAUDE_3_5_MODEL_CONFIG = {
  modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  region: "us-west-2",
};

const CLAUDE_3_7_MODEL_CONFIG = {
  modelId: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  region: "us-east-1",
};

const DEFAULT_MODEL_CONFIG: ModelConfig = CLAUDE_3_5_MODEL_CONFIG;

const FALLBACK_MODEL_CONFIG: ModelConfig = CLAUDE_3_5_MODEL_CONFIG;

const FALLBACK_MODEL_CONFIG_2: ModelConfig = CLAUDE_3_7_MODEL_CONFIG;

const modelMap: Record<ModelId, ModelConfig> = {
  "claude-3.5": CLAUDE_3_5_MODEL_CONFIG,
  "claude-3.7": CLAUDE_3_7_MODEL_CONFIG,
};

export function getModelConfig(model: ModelId): ModelConfig {
  const modelConfig = modelMap[model];
  if (modelConfig == null) {
    return DEFAULT_MODEL_CONFIG;
  }
  return modelConfig;
}

export function getLanguageModel(model: string | undefined): {
  model: LanguageModel;
  provider: ModelProvider;
} {
  if (model === "command-a" || model === "command-r-plus") {
    // TODO: remove command-r-plus once fern generate change is resolved
    const cohere = createCohere({ apiKey: cohereApiKey() });
    return {
      model: cohere("command-a-03-2025"),
      provider: "cohere",
    };
  }

  const modelConfig = getModelConfig(model ?? "claude-3.5");
  if (model === "claude-4") {
    const anthropic = createAnthropic({ apiKey: anthropicApiKey() });
    const bedrock_3_5 = createAmazonBedrock({
      region: FALLBACK_MODEL_CONFIG.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    const bedrock_3_7 = createAmazonBedrock({
      region: FALLBACK_MODEL_CONFIG_2.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    return {
      model: createFallback({
        models: [
          anthropic("claude-4-sonnet-20250514"),
          bedrock_3_5(FALLBACK_MODEL_CONFIG.modelId),
          bedrock_3_7(FALLBACK_MODEL_CONFIG_2.modelId),
        ],
      }),
      provider: "anthropic",
    };
  }

  const bedrock = createAmazonBedrock({
    region: modelConfig.region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  return {
    model: bedrock(modelConfig.modelId),
    provider: "bedrock",
  };
}
