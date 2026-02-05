import "server-only";

import * as esbuild from "esbuild";

/**
 * Strips React/ReactDOM imports from source code.
 * These are provided as globals by getMDXExport, so importing them would cause
 * require() calls that don't work in the browser context.
 */
function stripReactImports(source: string): string {
    // Remove various forms of React imports:
    // - import React from 'react'
    // - import * as React from 'react'
    // - import { useState, useEffect } from 'react'
    // - import React, { useState } from 'react'
    // - import ReactDOM from 'react-dom'
    const importPatterns = [
        // Default imports: import React from 'react'
        /^\s*import\s+React\s+from\s+['"]react['"];?\s*$/gm,
        // Namespace imports: import * as React from 'react'
        /^\s*import\s+\*\s+as\s+React\s+from\s+['"]react['"];?\s*$/gm,
        // Named imports: import { useState } from 'react'
        /^\s*import\s+\{[^}]*\}\s+from\s+['"]react['"];?\s*$/gm,
        // Default + named: import React, { useState } from 'react'
        /^\s*import\s+React\s*,\s*\{[^}]*\}\s+from\s+['"]react['"];?\s*$/gm,
        // ReactDOM imports
        /^\s*import\s+ReactDOM\s+from\s+['"]react-dom['"];?\s*$/gm,
        /^\s*import\s+\*\s+as\s+ReactDOM\s+from\s+['"]react-dom['"];?\s*$/gm,
        /^\s*import\s+\{[^}]*\}\s+from\s+['"]react-dom['"];?\s*$/gm,
        // React types (TypeScript)
        /^\s*import\s+type\s+.*\s+from\s+['"]react['"];?\s*$/gm
    ];

    let result = source;
    for (const pattern of importPatterns) {
        result = result.replace(pattern, "// [stripped react import]");
    }
    return result;
}

/**
 * Compiles TSX/JSX source code to JavaScript on the server side.
 * This enables server-side rendering of custom React components.
 *
 * @param source - The TSX/JSX source code to compile
 * @param filename - The filename (used to determine loader type)
 * @returns The compiled JavaScript code as a string
 */
export async function compileTsx(source: string, filename: string): Promise<string> {
    // Strip React imports since React is provided as a global
    const processedSource = stripReactImports(source);

    // Determine the loader based on file extension
    let loader: esbuild.Loader = "tsx";
    if (filename.endsWith(".jsx")) {
        loader = "jsx";
    } else if (filename.endsWith(".ts") && !filename.endsWith(".tsx")) {
        loader = "ts";
    } else if (filename.endsWith(".js")) {
        loader = "js";
    }

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
