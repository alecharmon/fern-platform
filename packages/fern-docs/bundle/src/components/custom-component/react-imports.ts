/**
 * Replaces React/ReactDOM imports with variable declarations that reference the globals.
 *
 * Named imports like `import { useState, useEffect } from 'react'` become
 * `const { useState, useEffect } = React;` so users can use hooks directly.
 *
 * Default/namespace imports and type-only imports are simply stripped since
 * React and ReactDOM are already available as globals.
 */
export function replaceReactImports(source: string): string {
    let result = source;

    // Convert `import React, { useState } from 'react'` → `const { useState } = React;`
    result = result.replace(
        /^\s*import\s+React\s*,\s*\{([^}]*)\}\s+from\s+['"]react['"];?\s*$/gm,
        (_match, names: string) => {
            const cleaned = names
                .split(",")
                .map((n) => n.trim())
                .filter(Boolean)
                .join(", ");
            return cleaned ? `const { ${cleaned} } = React;` : "";
        }
    );

    // Convert `import { useState, useEffect } from 'react'` → `const { useState, useEffect } = React;`
    result = result.replace(/^\s*import\s+\{([^}]*)\}\s+from\s+['"]react['"];?\s*$/gm, (_match, names: string) => {
        const cleaned = names
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
            .join(", ");
        return cleaned ? `const { ${cleaned} } = React;` : "";
    });

    // Strip default/namespace/type imports for react and react-dom
    // These are provided as globals by getMDXExport, so importing them would cause
    // require() calls that don't work in the browser context.
    const stripPatterns = [
        /^\s*import\s+React\s+from\s+['"]react['"];?\s*$/gm,
        /^\s*import\s+\*\s+as\s+React\s+from\s+['"]react['"];?\s*$/gm,
        /^\s*import\s+ReactDOM\s+from\s+['"]react-dom['"];?\s*$/gm,
        /^\s*import\s+\*\s+as\s+ReactDOM\s+from\s+['"]react-dom['"];?\s*$/gm,
        /^\s*import\s+\{[^}]*\}\s+from\s+['"]react-dom['"];?\s*$/gm,
        /^\s*import\s+type\s+.*\s+from\s+['"]react['"];?\s*$/gm
    ];
    for (const pattern of stripPatterns) {
        result = result.replace(pattern, "");
    }

    return result;
}
