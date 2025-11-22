import { isNonNullish, unknownToString, visitDiscriminatedUnion } from "@fern-api/ui-core-utils";

import { PlaygroundFormDataEntryValue } from "../../types";
import { buildPath, buildUrlWithQueryParams, indentAfter } from "./common";
import { PlaygroundCodeSnippetBuilder } from "./types";

interface PythonRequestParams {
    json?: string;
    data?: string;
    files?: string;
}

export class PythonRequestSnippetBuilder extends PlaygroundCodeSnippetBuilder {
    #buildRequests({ json, data, files }: PythonRequestParams) {
        // Remove Content-Type header when:
        // - Using json= (requests sets application/json automatically)
        // - Using files= (requests sets multipart/form-data with boundary automatically)
        // Keep it for data= to make form-urlencoded explicit
        const shouldRemoveContentType = json != null || files != null;
        const headers = shouldRemoveContentType
            ? { ...this.formState.headers, "Content-Type": undefined }
            : this.formState.headers;

        return `# ${this.context.node.title} (${this.context.endpoint.method} ${buildPath(this.context.endpoint.path)})
response = requests.${this.context.endpoint.method.toLowerCase()}(
  "${buildUrlWithQueryParams(this.url, this.formState.queryParameters)}",
  headers=${indentAfter(JSON.stringify(headers, undefined, 2), 2, 0)},${json != null ? `\n  json=${indentAfter(json, 2, 0)},` : ""}${
      data != null ? `\n  data=${indentAfter(data, 2, 0)},` : ""
  }${files != null ? `\n  files=${indentAfter(files, 2, 0)},` : ""}
)

print(response.json())`;
    }

    #formatFormDataValue(value: unknown): string {
        if (typeof value === "object" && !Array.isArray(value)) {
            return `json.dumps(${indentAfter(JSON.stringify(value, undefined, 2), 2, 0)})`;
        }
        if (typeof value === "object" && Array.isArray(value) && value.length === 1) {
            return JSON.stringify(value[0]);
        }
        return JSON.stringify(value);
    }

    // Convert JavaScript value to Python literal syntax
    #toPythonLiteral(value: unknown): string {
        if (value === null || value === undefined) {
            return "None";
        }
        if (typeof value === "boolean") {
            return value ? "True" : "False";
        }
        if (typeof value === "string") {
            return JSON.stringify(value);
        }
        if (typeof value === "number") {
            return String(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((v) => this.#toPythonLiteral(v)).join(", ")}]`;
        }
        if (typeof value === "object") {
            const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${this.#toPythonLiteral(v)}`);
            return `{\n  ${entries.join(",\n  ")}\n}`;
        }
        return String(value);
    }

    // Convert JavaScript value to URL-encoded form data string representation
    #toUrlEncodedLiteral(value: unknown): string {
        if (value === null || value === undefined) {
            return "None";
        }
        if (typeof value === "boolean") {
            return JSON.stringify(value ? "true" : "false");
        }
        if (typeof value === "string") {
            return JSON.stringify(value);
        }
        if (typeof value === "number") {
            return String(value);
        }
        if (Array.isArray(value)) {
            return `[${value.map((v) => this.#toUrlEncodedLiteral(v)).join(", ")}]`;
        }
        if (typeof value === "object") {
            const entries = Object.entries(value)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${JSON.stringify(k)}: ${this.#toUrlEncodedLiteral(v)}`);
            return `{\n  ${entries.join(",\n  ")}\n}`;
        }
        return String(value);
    }

    public override build(): string {
        const imports = ["requests"];

        if (this.formState.body == null) {
            return `${imports.map((pkg) => `import ${pkg}`).join("\n")}

${this.#buildRequests({})}`;
        }

        return visitDiscriminatedUnion(this.formState.body, "type")._visit<string>({
            json: ({ value }) => {
                // Check if Content-Type is application/x-www-form-urlencoded
                const isFormUrlEncoded = unknownToString(
                    this.formState.headers["Content-Type"] ?? this.formState.headers["content-type"] ?? ""
                )
                    .toLowerCase()
                    .includes("form-urlencoded");

                if (isFormUrlEncoded) {
                    // Use data= for form-urlencoded with Python dict syntax
                    // Only include data if value has non-nullish entries after filtering
                    const hasData =
                        value != null &&
                        (typeof value !== "object" || Object.values(value).some((v) => v !== null && v !== undefined));
                    return `${imports.map((pkg) => `import ${pkg}`).join("\n")}

${this.#buildRequests({ data: hasData ? this.#toUrlEncodedLiteral(value) : undefined })}`;
                }

                // Use json= for application/json
                return `${imports.map((pkg) => `import ${pkg}`).join("\n")}

${this.#buildRequests({ json: JSON.stringify(this.maybeWrapJsonBody(value), undefined, 2) })}`;
            },
            "form-data": ({ value }) => {
                const singleFiles = Object.entries(value)
                    .filter((entry): entry is [string, PlaygroundFormDataEntryValue.SingleFile] =>
                        PlaygroundFormDataEntryValue.isSingleFile(entry[1])
                    )
                    .map(([k, v]) => {
                        if (v.value == null) {
                            return undefined;
                        }
                        return `'${k}', ('${v.value.name}', open('${v.value.name}', 'rb')),`;
                    })
                    .filter(isNonNullish);
                const fileArrays = Object.entries(value)
                    .filter((entry): entry is [string, PlaygroundFormDataEntryValue.MultipleFiles] =>
                        PlaygroundFormDataEntryValue.isMultipleFiles(entry[1])
                    )
                    .map(([k, v]) => {
                        const fileStrings = v.value.map(
                            (file) => `'${k}': ('${file.name}', open('${file.name}', 'rb'))`
                        );
                        if (fileStrings.length === 0) {
                            return;
                        }
                        return fileStrings.join(",\n");
                    })
                    .filter(isNonNullish);

                const dataEntries = Object.entries(value)
                    .filter(
                        (entry): entry is [string, PlaygroundFormDataEntryValue.Json] =>
                            PlaygroundFormDataEntryValue.isJson(entry[1]) ||
                            PlaygroundFormDataEntryValue.isExploded(entry[1])
                    )
                    .map(([k, v]) => {
                        if (PlaygroundFormDataEntryValue.isExploded(v)) {
                            const items: string[] = [];
                            for (const item of (v as PlaygroundFormDataEntryValue.Exploded).value) {
                                items.push(`'${k}': ${this.#formatFormDataValue(item)},`);
                            }
                            return items.join("\n");
                        }

                        return v.value == null ? undefined : `'${k}': ${this.#formatFormDataValue(v.value)},`;
                    })
                    .filter(isNonNullish)
                    .join("\n");

                let fileEntries = [...singleFiles, ...fileArrays].join("\n");
                let data: string | undefined = undefined;

                if (fileEntries.length === 0 && dataEntries.length > 0) {
                    fileEntries = Object.entries(value)
                        .filter(
                            (entry): entry is [string, PlaygroundFormDataEntryValue.Json] =>
                                PlaygroundFormDataEntryValue.isJson(entry[1]) ||
                                PlaygroundFormDataEntryValue.isExploded(entry[1])
                        )
                        .map(([k, v]) => {
                            if (PlaygroundFormDataEntryValue.isExploded(v)) {
                                const items: string[] = [];
                                for (const item of (v as PlaygroundFormDataEntryValue.Exploded).value) {
                                    items.push(`'${k}': (None, ${this.#formatFormDataValue(item)})`);
                                }
                                return items.join(",\n");
                            }

                            return v.value == null
                                ? undefined
                                : `'${k}': (None, ${this.#formatFormDataValue(v.value)})`;
                        })
                        .filter(isNonNullish)
                        .join(",\n");
                } else if (dataEntries.length > 0) {
                    data = `{\n${indentAfter(dataEntries, 2)}\n}`;
                }

                const files = fileEntries.length > 0 ? `{\n${indentAfter(fileEntries, 2)}\n}` : undefined;

                if (data?.includes("json.dumps") || fileEntries.includes("json.dumps")) {
                    imports.push("json");
                }

                return `${imports.map((pkg) => `import ${pkg}`).join("\n")}

${this.#buildRequests({ data, files })}`;
            },
            "octet-stream": (f) => `${imports.map((pkg) => `import ${pkg}`).join("\n")}

${this.#buildRequests({ data: f.value != null ? `open('${f.value?.name}', 'rb').read()` : undefined })}`,
            _other: () => `${imports.map((pkg) => `import ${pkg}`).join("\n")}

${this.#buildRequests({})}`
        });
    }
}
