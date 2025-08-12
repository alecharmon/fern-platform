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

    return new EndpointProvider({
      config: {
        ...this.getGeneratorConfigForLanguage(language),
        ...snippetInput.config,
      },
      language,
      ir: snippetInput.ir,
    });
  }

  private getGeneratorConfigForLanguage(
    language: Language
  ): generatorExec.config.GeneratorConfig {
    switch (language) {
      case "python": {
        return python as unknown as generatorExec.config.GeneratorConfig;
      }
      case "typescript": {
        return typescript as unknown as generatorExec.config.GeneratorConfig;
      }
      case "java": {
        return java as unknown as generatorExec.config.GeneratorConfig;
      }
      case "php": {
        return php as unknown as generatorExec.config.GeneratorConfig;
      }
      case "ruby": {
        return ruby as unknown as generatorExec.config.GeneratorConfig;
      }
      case "csharp": {
        return csharp as unknown as generatorExec.config.GeneratorConfig;
      }
      case "go": {
        return go as unknown as generatorExec.config.GeneratorConfig;
      }
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }
}
