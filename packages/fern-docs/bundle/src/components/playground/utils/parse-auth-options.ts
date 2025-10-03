export interface AuthOption {
    key: string;
    value: string;
    selected: boolean;
}

/**
 * parses a bearer token string that contains multiple key-value pairs
 * and returns an array of AuthOption objects
 * ex. [{'application 1': 123}, {'application 2': 345}]
 * ex. [{'application 1': 123, 'selected': false}, {'application 2': 456, 'selected': true}]
 *
 * @param token - the bearer token string to parse
 * @returns array of AuthOption objects, or empty array if no matches found
 */
export function parseAuthOptions(token: string): AuthOption[] {
    const options = token.match(/\{[^}]+\}/g);

    if (!options) {
        return [];
    }

    let explicitSelected = false;
    const parsedOptions = options.map((option) => {
        // remove the outer braces
        const content = option.slice(1, -1).trim();

        // isolate key-value pairs
        const pairs = content.split(",").map((pair) => pair.trim());
        const parsedPairs: Record<string, string> = {};
        let hasSelectedProperty = false;
        let selectedValue = false;

        for (const pair of pairs) {
            const kvMatch = pair.split(":");

            if (kvMatch?.[0] && kvMatch[1] !== undefined) {
                let key = kvMatch[0].trim();
                let value = kvMatch[1].trim();

                // remove quotes
                if (key.startsWith("'") && key.endsWith("'")) {
                    key = key.slice(1, -1);
                }

                if (value.startsWith("'") && value.endsWith("'")) {
                    value = value.slice(1, -1);
                }

                if (key === "selected") {
                    hasSelectedProperty = true;
                    selectedValue = value === "true";
                } else {
                    // store the first non-selected key-value pair as the main key-value
                    if (!parsedPairs.key) {
                        parsedPairs.key = key;
                        parsedPairs.value = value;
                    }
                }
            }
        }

        if (selectedValue) {
            explicitSelected = true;
        }

        // if we have a valid key-value pair and a selected property, use them
        if (parsedPairs.key && parsedPairs.value && hasSelectedProperty) {
            return {
                key: parsedPairs.key,
                value: parsedPairs.value,
                selected: selectedValue
            };
        }

        // fallback to the first key-value pair if no selected property
        if (parsedPairs.key && parsedPairs.value) {
            return {
                key: parsedPairs.key,
                value: parsedPairs.value,
                selected: false
            };
        }

        // fallback for malformed matches
        return {
            key: option,
            value: option,
            selected: false
        };
    });

    // if no option has been explicitly selected, set the first valid option to true
    if (!explicitSelected) {
        // find the first valid option (not malformed)
        const firstValidOption = parsedOptions.find((option) => {
            // skip options that look malformed (have the same key and value)
            if (option.key === option.value) {
                return false;
            }
            // skip options with empty keys or values
            if (!option.key || !option.value || option.key === "" || option.value === "") {
                return false;
            }
            return true;
        });

        if (firstValidOption) {
            firstValidOption.selected = true;
        } else if (parsedOptions[0]) {
            // if no valid option found, fall back to first option
            parsedOptions[0].selected = true;
        }
    }

    return parsedOptions;
}

/**
 * converts parsed AuthOptions list back into a bearer token form
 *
 * @param options - array of AuthOption objects
 * @returns a string representing the auth objects
 */
export function convertAuthOptionsToToken(options: AuthOption[]): string {
    if (options.length === 0) {
        return "[]";
    }

    let token = "[";
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (!option) continue;
        token += `{${option.key}: ${option.value}, 'selected': ${option.selected}}`;
        // add comma only if not the last option
        if (i < options.length - 1) {
            token += ", ";
        }
    }
    token += "]";
    return token;
}

/**
 * returns the selected AuthOption from a bearer token string
 *
 * @param token - the bearer token string to parse
 * @returns the selected AuthOption, or the first valid option if none explicitly selected, or a fallback object if parsing fails
 */
export function returnSelectedOption(token: string): AuthOption {
    const options = parseAuthOptions(token);

    if (!options || options.length === 0) {
        return {
            key: "",
            value: token,
            selected: true
        };
    }

    // Return the selected option (parseAuthOptions handles the selection logic)
    return options.find((option) => option.selected) ?? options[0] ?? { key: "", value: token, selected: true };
}

export function isMultiAuthToken(token: string): boolean {
    const options = token.match(/\{[^}]+\}/g);

    return options != null && options.length > 0;
}
