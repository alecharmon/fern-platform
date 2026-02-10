import "server-only";

import * as esbuild from "esbuild";
import * as path from "path";
import { replaceReactImports } from "./react-imports";

function getLoaderForFile(filename: string): esbuild.Loader {
    if (filename.endsWith(".jsx")) {
        return "jsx";
    } else if (filename.endsWith(".ts") && !filename.endsWith(".tsx")) {
        return "ts";
    } else if (filename.endsWith(".js")) {
        return "js";
    }
    return "tsx";
}

function createVirtualFsPlugin(entryPath: string, files: Record<string, string>): esbuild.Plugin {
    return {
        name: "virtual-fs",
        setup(build) {
            build.onResolve({ filter: /^\./ }, (args) => {
                const dir = path.dirname(args.importer === "<stdin>" ? entryPath : args.importer);
                const resolved = path.join(dir, args.path);

                const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.js`, `${resolved}.jsx`];
                for (const candidate of candidates) {
                    if (files[candidate] != null) {
                        return { path: candidate, namespace: "virtual" };
                    }
                }

                const indexCandidates = [
                    path.join(resolved, "index.ts"),
                    path.join(resolved, "index.tsx"),
                    path.join(resolved, "index.js"),
                    path.join(resolved, "index.jsx")
                ];
                for (const candidate of indexCandidates) {
                    if (files[candidate] != null) {
                        return { path: candidate, namespace: "virtual" };
                    }
                }

                return undefined;
            });

            build.onResolve({ filter: /^react(-dom)?$/ }, (args) => {
                return { path: args.path, namespace: "react-shim" };
            });

            build.onLoad({ filter: /.*/, namespace: "react-shim" }, (args) => {
                if (args.path === "react-dom") {
                    return { contents: "export default ReactDOM;", loader: "js" };
                }
                return { contents: "export default React;", loader: "js" };
            });

            build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
                const source = files[args.path];
                if (source == null) {
                    return undefined;
                }
                return {
                    contents: replaceReactImports(source),
                    loader: getLoaderForFile(args.path)
                };
            });
        }
    };
}

async function compileTsxWithBundle(source: string, filename: string, files: Record<string, string>): Promise<string> {
    const processedSource = replaceReactImports(source);

    const absFilename = path.resolve(filename);
    const absFiles: Record<string, string> = {};
    for (const [key, value] of Object.entries(files)) {
        absFiles[path.resolve(key)] = value;
    }
    absFiles[absFilename] = processedSource;

    const result = await esbuild.build({
        stdin: {
            contents: processedSource,
            loader: getLoaderForFile(filename),
            resolveDir: path.dirname(absFilename),
            sourcefile: path.basename(absFilename)
        },
        bundle: true,
        write: false,
        format: "iife",
        globalName: "__exports__",
        target: "es2020",
        jsx: "transform",
        jsxFactory: "React.createElement",
        jsxFragment: "React.Fragment",
        minify: false,
        plugins: [createVirtualFsPlugin(absFilename, absFiles)]
    });

    const output = result.outputFiles?.[0]?.text ?? "";
    return output + "\nreturn __exports__;";
}

/**
 * Compiles TSX/JSX source code to JavaScript on the server side.
 * Supports direct React hook imports and relative file imports.
 *
 * @param source - The TSX/JSX source code to compile
 * @param filename - The filename (used to determine loader type)
 * @param files - Optional map of all available files for resolving imports
 * @returns The compiled JavaScript code as a string
 */
export async function compileTsx(source: string, filename: string, files?: Record<string, string>): Promise<string> {
    const hasRelativeImports = /^\s*import\s+.*from\s+['"]\./m.test(source);

    if (hasRelativeImports && files != null) {
        return compileTsxWithBundle(source, filename, files);
    }

    const processedSource = replaceReactImports(source);
    const loader = getLoaderForFile(filename);

    const result = await esbuild.transform(processedSource, {
        loader,
        format: "iife",
        globalName: "__exports__",
        target: "es2020",
        // Use classic JSX transform with React.createElement
        // This works with the globals provided by getMDXExport (React, ReactDOM, _jsx_runtime)
        // The "automatic" transform generates require('react/jsx-runtime') which doesn't work
        jsx: "transform",
        jsxFactory: "React.createElement",
        jsxFragment: "React.Fragment",
        minify: false
    });

    // The IIFE format wraps the code and assigns exports to __exports__
    // getMDXExport uses `new Function(...keys, code)` and expects the code to RETURN the exports
    // So we append `return __exports__;` to make it compatible
    return result.code + "\nreturn __exports__;";
}
