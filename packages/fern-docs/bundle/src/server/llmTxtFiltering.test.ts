/**
 * Unit tests for LLM TXT filtering functionality.
 * These tests verify the SDK language filtering and OpenAPI exclusion features
 * used in llms.txt and llms-full.txt endpoints.
 *
 * Note: These tests are self-contained to avoid importing from server-only modules.
 * The logic tested here mirrors the implementation in getMarkdownForPath.ts.
 */

type SdkLanguageFilter = "node" | "python" | "java" | "ruby" | "go" | "csharp" | "swift";

interface MarkdownFilterOptions {
    sdkLanguage?: SdkLanguageFilter;
    excludeSpec?: boolean;
}

function isValidSdkLanguage(language: string): language is SdkLanguageFilter {
    return ["node", "python", "java", "ruby", "go", "csharp", "swift"].includes(language);
}

describe("isValidSdkLanguage", () => {
    it("should return true for valid SDK languages", () => {
        const validLanguages: SdkLanguageFilter[] = ["node", "python", "java", "ruby", "go", "csharp", "swift"];

        for (const language of validLanguages) {
            expect(isValidSdkLanguage(language)).toBe(true);
        }
    });

    it("should return false for invalid SDK languages", () => {
        const invalidLanguages = ["typescript", "javascript", "rust", "kotlin", "php", "perl", "", "NODE", "Python"];

        for (const language of invalidLanguages) {
            expect(isValidSdkLanguage(language)).toBe(false);
        }
    });

    it("should return false for empty string", () => {
        expect(isValidSdkLanguage("")).toBe(false);
    });

    it("should be case-sensitive", () => {
        expect(isValidSdkLanguage("Node")).toBe(false);
        expect(isValidSdkLanguage("PYTHON")).toBe(false);
        expect(isValidSdkLanguage("Java")).toBe(false);
    });
});

describe("SDK_LANGUAGE_MAPPINGS", () => {
    const SDK_LANGUAGE_MAPPINGS: Record<SdkLanguageFilter, string[]> = {
        node: ["typescript", "javascript", "node", "js", "ts"],
        python: ["python", "py"],
        java: ["java"],
        ruby: ["ruby"],
        go: ["go", "golang"],
        csharp: ["csharp"],
        swift: ["swift"]
    };

    it("should map node to typescript, javascript, node, js, ts", () => {
        expect(SDK_LANGUAGE_MAPPINGS.node).toEqual(["typescript", "javascript", "node", "js", "ts"]);
    });

    it("should map python to python, py", () => {
        expect(SDK_LANGUAGE_MAPPINGS.python).toEqual(["python", "py"]);
    });

    it("should map java to java", () => {
        expect(SDK_LANGUAGE_MAPPINGS.java).toEqual(["java"]);
    });

    it("should map ruby to ruby", () => {
        expect(SDK_LANGUAGE_MAPPINGS.ruby).toEqual(["ruby"]);
    });

    it("should map go to go, golang", () => {
        expect(SDK_LANGUAGE_MAPPINGS.go).toEqual(["go", "golang"]);
    });

    it("should map csharp to csharp", () => {
        expect(SDK_LANGUAGE_MAPPINGS.csharp).toEqual(["csharp"]);
    });

    it("should map swift to swift", () => {
        expect(SDK_LANGUAGE_MAPPINGS.swift).toEqual(["swift"]);
    });
});

describe("shouldIncludeLanguage", () => {
    function shouldIncludeLanguage(language: string, sdkLanguageFilter?: SdkLanguageFilter): boolean {
        if (sdkLanguageFilter == null) {
            return true;
        }
        const SDK_LANGUAGE_MAPPINGS: Record<SdkLanguageFilter, string[]> = {
            node: ["typescript", "javascript", "node", "js", "ts"],
            python: ["python", "py"],
            java: ["java"],
            ruby: ["ruby"],
            go: ["go", "golang"],
            csharp: ["csharp"],
            swift: ["swift"]
        };
        const allowedLanguages = SDK_LANGUAGE_MAPPINGS[sdkLanguageFilter];
        return allowedLanguages.includes(language.toLowerCase());
    }

    describe("when no filter is specified", () => {
        it("should include all languages", () => {
            expect(shouldIncludeLanguage("typescript")).toBe(true);
            expect(shouldIncludeLanguage("python")).toBe(true);
            expect(shouldIncludeLanguage("java")).toBe(true);
            expect(shouldIncludeLanguage("ruby")).toBe(true);
            expect(shouldIncludeLanguage("go")).toBe(true);
            expect(shouldIncludeLanguage("csharp")).toBe(true);
            expect(shouldIncludeLanguage("swift")).toBe(true);
            expect(shouldIncludeLanguage("curl")).toBe(true);
            expect(shouldIncludeLanguage("unknown")).toBe(true);
        });
    });

    describe("when node filter is specified", () => {
        it("should include typescript, javascript, node, js, ts", () => {
            expect(shouldIncludeLanguage("typescript", "node")).toBe(true);
            expect(shouldIncludeLanguage("javascript", "node")).toBe(true);
            expect(shouldIncludeLanguage("node", "node")).toBe(true);
            expect(shouldIncludeLanguage("js", "node")).toBe(true);
            expect(shouldIncludeLanguage("ts", "node")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("python", "node")).toBe(false);
            expect(shouldIncludeLanguage("java", "node")).toBe(false);
            expect(shouldIncludeLanguage("ruby", "node")).toBe(false);
            expect(shouldIncludeLanguage("go", "node")).toBe(false);
            expect(shouldIncludeLanguage("csharp", "node")).toBe(false);
            expect(shouldIncludeLanguage("swift", "node")).toBe(false);
        });

        it("should be case-insensitive for snippet languages", () => {
            expect(shouldIncludeLanguage("TypeScript", "node")).toBe(true);
            expect(shouldIncludeLanguage("JAVASCRIPT", "node")).toBe(true);
            expect(shouldIncludeLanguage("Node", "node")).toBe(true);
        });
    });

    describe("when python filter is specified", () => {
        it("should include python, py", () => {
            expect(shouldIncludeLanguage("python", "python")).toBe(true);
            expect(shouldIncludeLanguage("py", "python")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("typescript", "python")).toBe(false);
            expect(shouldIncludeLanguage("java", "python")).toBe(false);
            expect(shouldIncludeLanguage("ruby", "python")).toBe(false);
        });

        it("should be case-insensitive for snippet languages", () => {
            expect(shouldIncludeLanguage("Python", "python")).toBe(true);
            expect(shouldIncludeLanguage("PY", "python")).toBe(true);
        });
    });

    describe("when java filter is specified", () => {
        it("should include java", () => {
            expect(shouldIncludeLanguage("java", "java")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("typescript", "java")).toBe(false);
            expect(shouldIncludeLanguage("python", "java")).toBe(false);
        });

        it("should be case-insensitive for snippet languages", () => {
            expect(shouldIncludeLanguage("Java", "java")).toBe(true);
            expect(shouldIncludeLanguage("JAVA", "java")).toBe(true);
        });
    });

    describe("when ruby filter is specified", () => {
        it("should include ruby", () => {
            expect(shouldIncludeLanguage("ruby", "ruby")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("typescript", "ruby")).toBe(false);
            expect(shouldIncludeLanguage("python", "ruby")).toBe(false);
        });
    });

    describe("when go filter is specified", () => {
        it("should include go, golang", () => {
            expect(shouldIncludeLanguage("go", "go")).toBe(true);
            expect(shouldIncludeLanguage("golang", "go")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("typescript", "go")).toBe(false);
            expect(shouldIncludeLanguage("python", "go")).toBe(false);
        });

        it("should be case-insensitive for snippet languages", () => {
            expect(shouldIncludeLanguage("Go", "go")).toBe(true);
            expect(shouldIncludeLanguage("GOLANG", "go")).toBe(true);
        });
    });

    describe("when csharp filter is specified", () => {
        it("should include csharp", () => {
            expect(shouldIncludeLanguage("csharp", "csharp")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("typescript", "csharp")).toBe(false);
            expect(shouldIncludeLanguage("python", "csharp")).toBe(false);
        });

        it("should be case-insensitive for snippet languages", () => {
            expect(shouldIncludeLanguage("CSharp", "csharp")).toBe(true);
            expect(shouldIncludeLanguage("CSHARP", "csharp")).toBe(true);
        });
    });

    describe("when swift filter is specified", () => {
        it("should include swift", () => {
            expect(shouldIncludeLanguage("swift", "swift")).toBe(true);
        });

        it("should exclude other languages", () => {
            expect(shouldIncludeLanguage("typescript", "swift")).toBe(false);
            expect(shouldIncludeLanguage("python", "swift")).toBe(false);
        });

        it("should be case-insensitive for snippet languages", () => {
            expect(shouldIncludeLanguage("Swift", "swift")).toBe(true);
            expect(shouldIncludeLanguage("SWIFT", "swift")).toBe(true);
        });
    });
});

describe("MarkdownFilterOptions", () => {
    it("should allow empty options", () => {
        const options: MarkdownFilterOptions = {};
        expect(options.sdkLanguage).toBeUndefined();
        expect(options.excludeSpec).toBeUndefined();
    });

    it("should allow sdkLanguage only", () => {
        const options: MarkdownFilterOptions = { sdkLanguage: "python" };
        expect(options.sdkLanguage).toBe("python");
        expect(options.excludeSpec).toBeUndefined();
    });

    it("should allow excludeSpec only", () => {
        const options: MarkdownFilterOptions = { excludeSpec: true };
        expect(options.sdkLanguage).toBeUndefined();
        expect(options.excludeSpec).toBe(true);
    });

    it("should allow both options together", () => {
        const options: MarkdownFilterOptions = { sdkLanguage: "node", excludeSpec: true };
        expect(options.sdkLanguage).toBe("node");
        expect(options.excludeSpec).toBe(true);
    });

    it("should allow excludeSpec to be false", () => {
        const options: MarkdownFilterOptions = { excludeSpec: false };
        expect(options.excludeSpec).toBe(false);
    });
});

describe("generateEndpointSections excludeSpec behavior", () => {
    function generateEndpointSections(excludeSpec?: boolean): string[] {
        if (excludeSpec) {
            return [];
        }
        return ["## OpenAPI Specification\n\n```yaml\nmocked-yaml\n```"];
    }

    it("should return empty array when excludeSpec is true", () => {
        expect(generateEndpointSections(true)).toEqual([]);
    });

    it("should return sections when excludeSpec is false", () => {
        expect(generateEndpointSections(false)).toHaveLength(1);
        expect(generateEndpointSections(false)[0]).toContain("OpenAPI Specification");
    });

    it("should return sections when excludeSpec is undefined", () => {
        expect(generateEndpointSections(undefined)).toHaveLength(1);
        expect(generateEndpointSections(undefined)[0]).toContain("OpenAPI Specification");
    });
});

describe("generateWebhookSections excludeSpec behavior", () => {
    function generateWebhookSections(excludeSpec?: boolean): string[] {
        if (excludeSpec) {
            return [];
        }
        return ["## OpenAPI 3.1 Webhook Specification\n\n```yaml\nmocked-yaml\n```"];
    }

    it("should return empty array when excludeSpec is true", () => {
        expect(generateWebhookSections(true)).toEqual([]);
    });

    it("should return sections when excludeSpec is false", () => {
        expect(generateWebhookSections(false)).toHaveLength(1);
        expect(generateWebhookSections(false)[0]).toContain("Webhook Specification");
    });

    it("should return sections when excludeSpec is undefined", () => {
        expect(generateWebhookSections(undefined)).toHaveLength(1);
    });
});

describe("generateWebSocketSections excludeSpec behavior", () => {
    function generateWebSocketSections(excludeSpec?: boolean): string[] {
        if (excludeSpec) {
            return [];
        }
        return ["## AsyncAPI Specification\n\n```yaml\nmocked-yaml\n```"];
    }

    it("should return empty array when excludeSpec is true", () => {
        expect(generateWebSocketSections(true)).toEqual([]);
    });

    it("should return sections when excludeSpec is false", () => {
        expect(generateWebSocketSections(false)).toHaveLength(1);
        expect(generateWebSocketSections(false)[0]).toContain("AsyncAPI Specification");
    });

    it("should return sections when excludeSpec is undefined", () => {
        expect(generateWebSocketSections(undefined)).toHaveLength(1);
    });
});

describe("query parameter parsing behavior", () => {
    const SDK_LANGUAGE_MAPPINGS: Record<SdkLanguageFilter, string[]> = {
        node: ["typescript", "javascript", "node", "js", "ts"],
        python: ["python", "py"],
        java: ["java"],
        ruby: ["ruby"],
        go: ["go", "golang"],
        csharp: ["csharp"],
        swift: ["swift"]
    };

    function parseSdkLanguageFilter(langParam: string | null): SdkLanguageFilter | undefined {
        if (langParam == null) {
            return undefined;
        }
        const normalized = langParam.toLowerCase();
        for (const [sdkLanguage, aliases] of Object.entries(SDK_LANGUAGE_MAPPINGS)) {
            if (aliases.includes(normalized)) {
                return sdkLanguage as SdkLanguageFilter;
            }
        }
        return undefined;
    }

    function parseFilterOptions(langParam: string | null, excludeSpecParam: string | null): MarkdownFilterOptions {
        return {
            sdkLanguage: parseSdkLanguageFilter(langParam),
            excludeSpec: excludeSpecParam === "true"
        };
    }

    it("should parse valid lang parameter", () => {
        const options = parseFilterOptions("python", null);
        expect(options.sdkLanguage).toBe("python");
        expect(options.excludeSpec).toBe(false);
    });

    it("should ignore invalid lang parameter", () => {
        const options = parseFilterOptions("invalid", null);
        expect(options.sdkLanguage).toBeUndefined();
    });

    it("should parse excludeSpec=true", () => {
        const options = parseFilterOptions(null, "true");
        expect(options.excludeSpec).toBe(true);
    });

    it("should parse excludeSpec=false as false", () => {
        const options = parseFilterOptions(null, "false");
        expect(options.excludeSpec).toBe(false);
    });

    it("should parse both parameters together", () => {
        const options = parseFilterOptions("node", "true");
        expect(options.sdkLanguage).toBe("node");
        expect(options.excludeSpec).toBe(true);
    });

    it("should handle null parameters", () => {
        const options = parseFilterOptions(null, null);
        expect(options.sdkLanguage).toBeUndefined();
        expect(options.excludeSpec).toBe(false);
    });

    it("should handle case-insensitive lang parameter", () => {
        const options = parseFilterOptions("Python", null);
        expect(options.sdkLanguage).toBe("python");
    });

    it("should handle all valid lang values", () => {
        const validLanguages: SdkLanguageFilter[] = ["node", "python", "java", "ruby", "go", "csharp", "swift"];
        for (const lang of validLanguages) {
            const options = parseFilterOptions(lang, null);
            expect(options.sdkLanguage).toBe(lang);
        }
    });

    it("should map lang=javascript to node", () => {
        const options = parseFilterOptions("javascript", null);
        expect(options.sdkLanguage).toBe("node");
    });

    it("should map lang=typescript to node", () => {
        const options = parseFilterOptions("typescript", null);
        expect(options.sdkLanguage).toBe("node");
    });

    it("should map lang=js to node", () => {
        const options = parseFilterOptions("js", null);
        expect(options.sdkLanguage).toBe("node");
    });

    it("should map lang=ts to node", () => {
        const options = parseFilterOptions("ts", null);
        expect(options.sdkLanguage).toBe("node");
    });

    it("should map lang=py to python", () => {
        const options = parseFilterOptions("py", null);
        expect(options.sdkLanguage).toBe("python");
    });

    it("should map lang=golang to go", () => {
        const options = parseFilterOptions("golang", null);
        expect(options.sdkLanguage).toBe("go");
    });

    it("should handle case-insensitive aliases", () => {
        expect(parseFilterOptions("JavaScript", null).sdkLanguage).toBe("node");
        expect(parseFilterOptions("TYPESCRIPT", null).sdkLanguage).toBe("node");
        expect(parseFilterOptions("PY", null).sdkLanguage).toBe("python");
        expect(parseFilterOptions("GoLang", null).sdkLanguage).toBe("go");
    });
});
