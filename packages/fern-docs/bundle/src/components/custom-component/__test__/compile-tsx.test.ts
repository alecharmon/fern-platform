import { describe, expect, it } from "vitest";
import { replaceReactImports } from "../react-imports";

describe("replaceReactImports", () => {
    describe("named imports from react", () => {
        it("converts named imports to destructuring from React global", () => {
            const input = `import { useState, useEffect } from "react";`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useState, useEffect } = React;`);
        });

        it("handles single named import", () => {
            const input = `import { useState } from 'react';`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useState } = React;`);
        });

        it("handles imports with extra whitespace", () => {
            const input = `import {  useState ,  useEffect  } from "react";`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useState, useEffect } = React;`);
        });

        it("handles imports without semicolons", () => {
            const input = `import { useCallback } from "react"`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useCallback } = React;`);
        });

        it("handles single quotes", () => {
            const input = `import { useMemo } from 'react';`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useMemo } = React;`);
        });
    });

    describe("default + named imports from react", () => {
        it("converts React default + named imports to destructuring", () => {
            const input = `import React, { useState, useEffect } from "react";`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useState, useEffect } = React;`);
        });

        it("handles React default + single named import", () => {
            const input = `import React, { useState } from 'react';`;
            const result = replaceReactImports(input);
            expect(result).toBe(`const { useState } = React;`);
        });
    });

    describe("default/namespace imports (stripped)", () => {
        it("strips default React import", () => {
            const input = `import React from "react";`;
            const result = replaceReactImports(input);
            expect(result.trim()).toBe("");
        });

        it("strips namespace React import", () => {
            const input = `import * as React from "react";`;
            const result = replaceReactImports(input);
            expect(result.trim()).toBe("");
        });

        it("strips default ReactDOM import", () => {
            const input = `import ReactDOM from "react-dom";`;
            const result = replaceReactImports(input);
            expect(result.trim()).toBe("");
        });

        it("strips namespace ReactDOM import", () => {
            const input = `import * as ReactDOM from "react-dom";`;
            const result = replaceReactImports(input);
            expect(result.trim()).toBe("");
        });

        it("strips named react-dom imports", () => {
            const input = `import { createPortal } from "react-dom";`;
            const result = replaceReactImports(input);
            expect(result.trim()).toBe("");
        });

        it("strips type-only imports", () => {
            const input = `import type { FC, ReactNode } from "react";`;
            const result = replaceReactImports(input);
            expect(result.trim()).toBe("");
        });
    });

    describe("non-react imports preserved", () => {
        it("preserves non-react imports", () => {
            const input = `import { something } from "./my-module";`;
            const result = replaceReactImports(input);
            expect(result).toBe(input);
        });

        it("preserves third-party imports", () => {
            const input = `import lodash from "lodash";`;
            const result = replaceReactImports(input);
            expect(result).toBe(input);
        });
    });

    describe("mixed source code", () => {
        it("replaces react imports while preserving other code", () => {
            const input = [
                `import { useState } from "react";`,
                `import { myHelper } from "./utils";`,
                ``,
                `export default function App() {`,
                `    const [count, setCount] = useState(0);`,
                `    return <div>{count}</div>;`,
                `}`
            ].join("\n");

            const result = replaceReactImports(input);
            expect(result).toContain(`const { useState } = React;`);
            expect(result).toContain(`import { myHelper } from "./utils";`);
            expect(result).toContain(`export default function App()`);
            expect(result).not.toContain(`from "react"`);
        });

        it("handles multiple react-related imports", () => {
            const input = [
                `import React, { useState, useEffect } from "react";`,
                `import type { FC } from "react";`,
                `import ReactDOM from "react-dom";`,
                ``,
                `const App: FC = () => <div />;`
            ].join("\n");

            const result = replaceReactImports(input);
            expect(result).toContain(`const { useState, useEffect } = React;`);
            expect(result).not.toContain(`import React`);
            expect(result).not.toContain(`import type`);
            expect(result).not.toContain(`import ReactDOM`);
            expect(result).toContain(`const App`);
        });
    });
});
