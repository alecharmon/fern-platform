import { FernIr } from "@fern-api/dynamic-ir-sdk";
import { generatorExec } from "@fern-api/dynamic-ir-sdk/api";

import { EndpointProvider } from "./EndpointProvider";
import { Language } from "./Language";
import csharp from "./config/csharp/config.json";
import go from "./config/go/config.json";
import java from "./config/java/config.json";
import php from "./config/php/config.json";
import python from "./config/python/config.json";
import ruby from "./config/ruby/config.json";
import typescript from "./config/typescript/config.json";
import { SnippetInput } from "./types";

export interface SnippetResolverArgs {
  snippetInputs: SnippetInput[];
}

export class SnippetResolver {
  private snippetInputs: SnippetInput[];

  constructor(args: SnippetResolverArgs) {
    this.snippetInputs = args.snippetInputs;
  }

  public sdk(language: Language, _options = {}): EndpointProvider {
    return this.getGeneratorForLanguage({ language });
  }

  private getGeneratorForLanguage({
    language,
  }: {
    language: Language;
  }): EndpointProvider {
    const snippetInput = this.snippetInputs.find(
      (input) => input.language === language
    );

    if (!snippetInput) {
      throw new Error(`No configuration found for language: ${language}`);
    }

    const config = this.getGeneratorConfigForLanguage({
      language,
      customConfig: snippetInput.ir.generatorConfig,
    });

    return new EndpointProvider({
      config,
      language,
      ir: snippetInput.ir,
    });
  }

  private getGeneratorConfigForLanguage({
    language,
    customConfig,
  }: {
    language: Language;
    customConfig: FernIr.dynamic.GeneratorConfig | undefined;
  }): generatorExec.config.GeneratorConfig {
    const configMap: Record<Language, generatorExec.config.GeneratorConfig> = {
      python: python as unknown as generatorExec.config.GeneratorConfig,
      typescript: typescript as unknown as generatorExec.config.GeneratorConfig,
      java: java as unknown as generatorExec.config.GeneratorConfig,
      php: php as unknown as generatorExec.config.GeneratorConfig,
      ruby: ruby as unknown as generatorExec.config.GeneratorConfig,
      csharp: csharp as unknown as generatorExec.config.GeneratorConfig,
      go: go as unknown as generatorExec.config.GeneratorConfig,
    };

    const config = configMap[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    if (customConfig?.apiName) {
      config.workspaceName = customConfig.apiName;
    }

    if (customConfig?.organization) {
      config.organization = customConfig.organization;
    }

    if (customConfig?.customConfig) {
      config.customConfig = customConfig.customConfig;
    }

    if (
      customConfig?.outputConfig &&
      config.output.mode.type === "github" &&
      customConfig.outputConfig.type === "publish"
    ) {
      if (
        customConfig.outputConfig.value.type === "maven" &&
        config.output.mode.publishInfo?.type === "maven"
      ) {
        config.output.mode.publishInfo.coordinate =
          customConfig.outputConfig.value.coordinate;
      } else if (
        customConfig.outputConfig.value.type === "nuget" &&
        config.output.mode.publishInfo?.type === "nuget"
      ) {
        config.output.mode.publishInfo.packageName =
          customConfig.outputConfig.value.packageName;
      } else if (
        customConfig.outputConfig.value.type === "npm" &&
        config.output.mode.publishInfo?.type === "npm"
      ) {
        config.output.mode.publishInfo.packageName =
          customConfig.outputConfig.value.packageName;
      } else if (
        customConfig.outputConfig.value.type === "pypi" &&
        config.output.mode.publishInfo?.type === "pypi"
      ) {
        config.output.mode.publishInfo.packageName =
          customConfig.outputConfig.value.packageName;
      } else if (
        customConfig.outputConfig.value.type === "rubygems" &&
        config.output.mode.publishInfo?.type === "rubygems"
      ) {
        config.output.mode.publishInfo.packageName =
          customConfig.outputConfig.value.packageName;
      }
    }

    return config;
  }
}
