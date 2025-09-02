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

const FALLBACK_MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0";
const DEFAULT_MODEL_CONFIG: ModelConfig = {
  modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
  region: "us-west-2",
};

const modelMap: Record<ModelId, ModelConfig> = {
  "claude-3.5": {
    modelId: "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    region: "us-west-2",
  },
  "claude-3.7": {
    modelId: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    region: "us-east-1",
  },
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
    const bedrock = createAmazonBedrock({
      region: modelConfig.region,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    return {
      model: createFallback({
        models: [
          anthropic("claude-4-sonnet-20250514"),
          bedrock(FALLBACK_MODEL_ID),
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
