import { AuthOption, convertAuthOptionsToToken, parseAuthOptions, returnSelectedOption } from "./parse-auth-options";

describe("parseAuthOptions", () => {
    it("should parse valid token with single key-value pair", () => {
        const token = "{'application 1': 123}";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "application 1",
                value: "123",
                selected: true
            }
        ]);
    });

    it("should parse token for pre-selected value", () => {
        const token = "[{'application 1': 123, 'selected': false}, {'application 2': 456, 'selected': true}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "application 1",
                value: "123",
                selected: false
            },
            {
                key: "application 2",
                value: "456",
                selected: true
            }
        ]);
    });

    it("should parse valid token with multiple key-value pairs", () => {
        const token = "[{'application 1': 123}, {'application 2': 345}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "application 1",
                value: "123",
                selected: true
            },
            {
                key: "application 2",
                value: "345",
                selected: false
            }
        ]);
    });

    it("should handle tokens with spaces around colons", () => {
        const token = "[{'app1':123}, {'app2' : 456}, {'app3': 789}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "app1",
                value: "123",
                selected: true
            },
            {
                key: "app2",
                value: "456",
                selected: false
            },
            {
                key: "app3",
                value: "789",
                selected: false
            }
        ]);
    });

    it("should handle tokens with different value types", () => {
        const token = "[{'string_key': 'string_value'}, {'number_key': 42}, {'bool_key': true}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "string_key",
                value: "string_value",
                selected: true
            },
            {
                key: "number_key",
                value: "42",
                selected: false
            },
            {
                key: "bool_key",
                value: "true",
                selected: false
            }
        ]);
    });

    it("should handle tokens with special characters in keys and values", () => {
        const token = "[{'app-name': 'app_value'}, {'app_name': 'app-value'}, {'app.name': 'app.value'}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "app-name",
                value: "app_value",
                selected: true
            },
            {
                key: "app_name",
                value: "app-value",
                selected: false
            },
            {
                key: "app.name",
                value: "app.value",
                selected: false
            }
        ]);
    });

    it("should return empty array for token without matches", () => {
        const token = "invalid_token_format";
        const result = parseAuthOptions(token);

        expect(result).toEqual([]);
    });

    it("should return empty array for empty string", () => {
        const token = "";
        const result = parseAuthOptions(token);

        expect(result).toEqual([]);
    });

    it("should return empty array for token with only brackets", () => {
        const token = "[]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([]);
    });

    it("should handle malformed key-value pairs gracefully", () => {
        const token = "[{'incomplete_key'}, {'key':}, {'': 'value'}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "{'incomplete_key'}",
                value: "{'incomplete_key'}",
                selected: true
            },
            {
                key: "{'key':}",
                value: "{'key':}",
                selected: false
            },
            {
                key: "{'': 'value'}",
                value: "{'': 'value'}",
                selected: false
            }
        ]);
    });

    it("should handle tokens with nested quotes", () => {
        const token = "[{'key with \"quotes\"': 'value with \"quotes\"'}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: 'key with "quotes"',
                value: 'value with "quotes"',
                selected: true
            }
        ]);
    });

    it("should handle tokens with very long keys and values", () => {
        const longKey = "a".repeat(100);
        const longValue = "b".repeat(100);
        const token = `{'${longKey}': '${longValue}'}`;
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: longKey,
                value: longValue,
                selected: true
            }
        ]);
    });

    it("should handle tokens with unicode characters", () => {
        const token = "[{'café': 'résumé'}, {'über': 'naïve'}]";
        const result = parseAuthOptions(token);

        expect(result).toEqual([
            {
                key: "café",
                value: "résumé",
                selected: true
            },
            {
                key: "über",
                value: "naïve",
                selected: false
            }
        ]);
    });
});

describe("returnSelectedOption", () => {
    it("should return the explicitly selected option", () => {
        const token = "[{'app1': 123, 'selected': false}, {'app2': 456, 'selected': true}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app2",
            value: "456",
            selected: true
        });
    });

    it("should return the first option when no option is explicitly selected", () => {
        const token = "[{'app1': 123}, {'app2': 456}, {'app3': 789}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app1",
            value: "123",
            selected: true
        });
    });

    it("should return the first option when all selected properties are false", () => {
        const token = "[{'app1': 123, 'selected': false}, {'app2': 456, 'selected': false}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app1",
            value: "123",
            selected: true
        });
    });

    it("should return the single option when token has only one option", () => {
        const token = "{'app1': 123}";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app1",
            value: "123",
            selected: true
        });
    });

    it("should return the single option with selected property", () => {
        const token = "{'app1': 123, 'selected': true}";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app1",
            value: "123",
            selected: true
        });
    });

    it("should handle tokens with spaces around colons", () => {
        const token = "[{'app1': 123}, {'app2' : 456, 'selected': true}, {'app3': 789}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app2",
            value: "456",
            selected: true
        });
    });

    it("should handle quoted values", () => {
        const token = "[{'app1': 'string_value'}, {'app2': 456, 'selected': true}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app2",
            value: "456",
            selected: true
        });
    });

    it("should handle mixed value types", () => {
        const token = "[{'app1': 'string_value'}, {'app2': 42, 'selected': true}, {'app3': true}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app2",
            value: "42",
            selected: true
        });
    });

    it("should return token object when no valid options are found", () => {
        const token = "invalid_token_format";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "",
            value: "invalid_token_format",
            selected: true
        });
    });

    it("should return token object when options array is empty", () => {
        const token = "[]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "",
            value: "[]",
            selected: true
        });
    });

    it("should handle malformed options gracefully", () => {
        const token = "[{'incomplete_key'}, {'key':}, {'': 'value'}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "{'incomplete_key'}",
            value: "{'incomplete_key'}",
            selected: true
        });
    });

    it("should return first valid option when first option is malformed", () => {
        const token = "[{'key':}, {'app2': 456}, {'app3': 789}]";
        const result = returnSelectedOption(token);

        expect(result).toEqual({
            key: "app2",
            value: "456",
            selected: true
        });
    });
});

describe("convertAuthOptionsToToken", () => {
    it("should convert single auth option to token", () => {
        const options = [
            {
                key: "application 1",
                value: "123",
                selected: true
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe("[{application 1: 123, 'selected': true}]");
    });

    it("should convert multiple auth options to token", () => {
        const options = [
            {
                key: "application 1",
                value: "123",
                selected: false
            },
            {
                key: "application 2",
                value: "456",
                selected: true
            },
            {
                key: "application 3",
                value: "789",
                selected: false
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe(
            "[{application 1: 123, 'selected': false}, {application 2: 456, 'selected': true}, {application 3: 789, 'selected': false}]"
        );
    });

    it("should handle empty array", () => {
        const options: AuthOption[] = [];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe("[]");
    });

    it("should handle options with special characters in keys and values", () => {
        const options = [
            {
                key: "app-name",
                value: "app_value",
                selected: true
            },
            {
                key: "app.name",
                value: "app.value",
                selected: false
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe("[{app-name: app_value, 'selected': true}, {app.name: app.value, 'selected': false}]");
    });

    it("should handle options with quoted values", () => {
        const options = [
            {
                key: "string_key",
                value: "string_value",
                selected: true
            },
            {
                key: "number_key",
                value: "42",
                selected: false
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe("[{string_key: string_value, 'selected': true}, {number_key: 42, 'selected': false}]");
    });

    it("should handle options with boolean values", () => {
        const options = [
            {
                key: "bool_key",
                value: "true",
                selected: true
            },
            {
                key: "another_bool",
                value: "false",
                selected: false
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe("[{bool_key: true, 'selected': true}, {another_bool: false, 'selected': false}]");
    });

    it("should handle options with unicode characters", () => {
        const options = [
            {
                key: "café",
                value: "résumé",
                selected: true
            },
            {
                key: "über",
                value: "naïve",
                selected: false
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe("[{café: résumé, 'selected': true}, {über: naïve, 'selected': false}]");
    });

    it("should handle options with very long keys and values", () => {
        const longKey = "a".repeat(100);
        const longValue = "b".repeat(100);
        const options = [
            {
                key: longKey,
                value: longValue,
                selected: true
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe(`[{${longKey}: ${longValue}, 'selected': true}]`);
    });

    it("should handle options with spaces in keys and values", () => {
        const options = [
            {
                key: "application 1",
                value: "value with spaces",
                selected: true
            },
            {
                key: "another app",
                value: "another value",
                selected: false
            }
        ];
        const result = convertAuthOptionsToToken(options);

        expect(result).toBe(
            "[{application 1: value with spaces, 'selected': true}, {another app: another value, 'selected': false}]"
        );
    });
});

describe("convertAuthOptionsToToken integration with other functions", () => {
    it("should generate token that can be parsed back to same options", () => {
        const originalOptions: AuthOption[] = [
            {
                key: "app1",
                value: "123",
                selected: false
            },
            {
                key: "app2",
                value: "456",
                selected: true
            }
        ];

        const token = convertAuthOptionsToToken(originalOptions);
        const parsedOptions = parseAuthOptions(token);

        expect(parsedOptions).toEqual(originalOptions);
    });

    it("should generate token that works with returnSelectedOption", () => {
        const options: AuthOption[] = [
            {
                key: "app1",
                value: "123",
                selected: false
            },
            {
                key: "app2",
                value: "456",
                selected: true
            }
        ];

        const token = convertAuthOptionsToToken(options);
        const selectedOption = returnSelectedOption(token);

        expect(selectedOption).toEqual({
            key: "app2",
            value: "456",
            selected: true
        });
    });

    it("should handle round-trip conversion for complex options", () => {
        const originalOptions: AuthOption[] = [
            {
                key: "app-name",
                value: "app_value",
                selected: true
            },
            {
                key: "app.name",
                value: "app.value",
                selected: false
            },
            {
                key: "string_key",
                value: "string_value",
                selected: false
            }
        ];

        const token = convertAuthOptionsToToken(originalOptions);
        const parsedOptions = parseAuthOptions(token);

        expect(parsedOptions).toEqual(originalOptions);
    });

    it("should maintain selection state through conversion cycle", () => {
        const options: AuthOption[] = [
            {
                key: "first",
                value: "1",
                selected: false
            },
            {
                key: "second",
                value: "2",
                selected: true
            },
            {
                key: "third",
                value: "3",
                selected: false
            }
        ];

        const token = convertAuthOptionsToToken(options);
        const parsedOptions = parseAuthOptions(token);
        const selectedOption = returnSelectedOption(token);

        expect(parsedOptions).toEqual(options);
        expect(selectedOption).toEqual({
            key: "second",
            value: "2",
            selected: true
        });
    });

    it("should handle edge case with single option and false selection", () => {
        const options: AuthOption[] = [
            {
                key: "single",
                value: "value",
                selected: false
            }
        ];

        const token = convertAuthOptionsToToken(options);
        const parsedOptions = parseAuthOptions(token);
        const selectedOption = returnSelectedOption(token);

        expect(parsedOptions).toEqual([
            {
                key: "single",
                value: "value",
                selected: true // First option should be selected by default when parsing
            }
        ]);
        expect(selectedOption).toEqual({
            key: "single",
            value: "value",
            selected: true // First option should be selected by default when parsing
        });
    });
});
