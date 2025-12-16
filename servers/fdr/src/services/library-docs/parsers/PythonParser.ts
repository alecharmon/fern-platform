import path from "path";
import type { LibraryDefinition } from "../ir/types";
import type { Parser, ParserConfig } from "./Parser";

/**
 * Stub PythonParser - returns minimal mock IR to exercise the pipeline.
 */
export class PythonParserStub implements Parser {
    async parse(repoPath: string, config: ParserConfig): Promise<LibraryDefinition> {
        const repoName = path.basename(repoPath);

        return {
            name: repoName,
            language: "PYTHON",
            modules: [
                {
                    name: "client",
                    docstring: "Main client module.",
                    members: [
                        {
                            name: "Client",
                            kind: "class",
                            docstring: "The main API client.",
                            members: [
                                { name: "connect", kind: "function", docstring: "Connect to the service." },
                                { name: "disconnect", kind: "function", docstring: "Disconnect from the service." }
                            ]
                        },
                        { name: "create_client", kind: "function", docstring: "Factory function to create a client." }
                    ]
                },
                {
                    name: "types",
                    docstring: "Type definitions.",
                    members: [
                        { name: "Config", kind: "class", docstring: "Configuration options." },
                        { name: "DEFAULT_TIMEOUT", kind: "constant", docstring: "Default timeout value." }
                    ]
                }
            ],
            metadata: {
                sourceUrl: config.githubUrl,
                parsedAt: new Date(),
                parserVersion: "stub-1.0"
            }
        };
    }
}
