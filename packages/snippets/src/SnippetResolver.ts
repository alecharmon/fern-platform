import type { FernIr } from "@fern-api/dynamic-ir-sdk";
import csharpDefaults from "./config/csharp/config.json";
import goDefaults from "./config/go/config.json";
import javaDefaults from "./config/java/config.json";
import phpDefaults from "./config/php/config.json";
import pythonDefaults from "./config/python/config.json";
import rubyDefaults from "./config/ruby/config.json";
import swiftDefaults from "./config/swift/config.json";
import typescriptDefaults from "./config/typescript/config.json";
import { EndpointProvider } from "./EndpointProvider";
import type { Language } from "./Language";
import type { SnippetInput } from "./types";

const DEFAULT_CONFIGS: Record<Language, unknown> = {
    python: pythonDefaults,
    typescript: typescriptDefaults,
    java: javaDefaults,
    php: phpDefaults,
    ruby: rubyDefaults,
    csharp: csharpDefaults,
    go: goDefaults,
    swift: swiftDefaults
};

/**
 * Returns a fresh copy of the default generator config for the given language - safe to mutate.
 */
function createDefaultConfig(language: Language): FernIr.generatorExec.config.GeneratorConfig {
    const defaults = DEFAULT_CONFIGS[language];
    if (!defaults) {
        throw new Error(`Unsupported language: ${language}`);
    }
    return structuredClone(defaults) as FernIr.generatorExec.config.GeneratorConfig;
}

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

    private getGeneratorForLanguage({ language }: { language: Language }): EndpointProvider {
        const snippetInput = this.snippetInputs.find((input) => input.language === language);

        if (!snippetInput) {
            throw new Error(`No configuration found for language: ${language}`);
        }

        const config = this.getGeneratorConfigForLanguage({
            language,
            customConfig: snippetInput.ir.generatorConfig
        });

        return new EndpointProvider({
            config,
            language,
            ir: snippetInput.ir
        });
    }

    private getGeneratorConfigForLanguage({
        language,
        customConfig
    }: {
        language: Language;
        customConfig: FernIr.dynamic.GeneratorConfig | undefined;
    }): FernIr.generatorExec.config.GeneratorConfig {
        const config = createDefaultConfig(language);

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
            if (customConfig.outputConfig.value.type === "maven" && config.output.mode.publishInfo?.type === "maven") {
                config.output.mode.publishInfo.coordinate = customConfig.outputConfig.value.coordinate;
            } else if (
                customConfig.outputConfig.value.type === "nuget" &&
                config.output.mode.publishInfo?.type === "nuget"
            ) {
                config.output.mode.publishInfo.packageName = customConfig.outputConfig.value.packageName;
            } else if (
                customConfig.outputConfig.value.type === "npm" &&
                config.output.mode.publishInfo?.type === "npm"
            ) {
                config.output.mode.publishInfo.packageName = customConfig.outputConfig.value.packageName;
            } else if (
                customConfig.outputConfig.value.type === "pypi" &&
                config.output.mode.publishInfo?.type === "pypi"
            ) {
                config.output.mode.publishInfo.packageName = customConfig.outputConfig.value.packageName;
            } else if (
                customConfig.outputConfig.value.type === "rubygems" &&
                config.output.mode.publishInfo?.type === "rubygems"
            ) {
                config.output.mode.publishInfo.packageName = customConfig.outputConfig.value.packageName;
            } else if (language === "go") {
                config.output.mode.repoUrl = customConfig.outputConfig.value.repoUrl ?? "";
            }
        }

        return config;
    }
}
