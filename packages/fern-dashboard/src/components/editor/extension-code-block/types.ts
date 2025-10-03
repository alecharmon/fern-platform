import type { Root } from "hast";
import type { AutoOptions, LanguageFn, Options } from "lowlight";

export type LowlightInstance = {
    highlight: (language: string, value: string, options?: Readonly<Options> | null | undefined) => Root;
    highlightAuto: (value: string, options?: Readonly<AutoOptions> | null | undefined) => Root;
    listLanguages: () => string[];
    register: {
        (grammars: Readonly<Record<string, LanguageFn>>): undefined;
        (name: string, grammar: LanguageFn): undefined;
    };
    registerAlias: {
        (aliases: Readonly<Record<string, readonly string[] | string>>): undefined;
        (language: string, alias: readonly string[] | string): undefined;
    };
    registered: (aliasOrName: string) => boolean;
};
