var Component = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:process.env>
  var init_define_process_env = __esm({
    "<define:process.env>"() {
    }
  });

  // global-externals:react/jsx-runtime
  var require_jsx_runtime = __commonJS({
    "global-externals:react/jsx-runtime"(exports, module) {
      init_define_process_env();
      module.exports = _jsx_runtime;
    }
  });

  // _mdx_bundler_entry_point-_random_uuid_.mdx
  var mdx_bundler_entry_point__random_uuid__exports = {};
  __export(mdx_bundler_entry_point__random_uuid__exports, {
    default: () => MDXContent,
    frontmatter: () => frontmatter
  });
  init_define_process_env();
  var import_jsx_runtime = __toESM(require_jsx_runtime());

  // global-externals:@mdx-js/react
  init_define_process_env();
  var { useMDXComponents } = MdxJsReact;

  // _mdx_bundler_entry_point-_random_uuid_.mdx
  var frontmatter = {
    "title": "TWOSLASH PAGE"
  };
  function _createMdxContent(props) {
    const { CodeBlock, ErrorBoundary } = {
      ...useMDXComponents(),
      ...props.components
    };
    if (!CodeBlock) _missingMdxReference("CodeBlock", true);
    if (!ErrorBoundary) _missingMdxReference("ErrorBoundary", true);
    return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
      children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: "// @noErrors\nconsole.e;\n//       ^|\n",
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: "function add(a: number, b: number) {\n  //     ^^^\n  return a + b;\n}\n",
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: 'const level: string = "Danger";\n// ---cut---\nconsole.log(level);\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: "// @filename: a.ts\nexport const helloWorld: string = 'Hi'\n// ---cut---\n// @filename: b.ts\nimport { helloWorld } from './a'\n\nconsole.log(helloWorld)\n",
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: 'const level: string = "Danger";\n// ---cut-before---\nconsole.log(level);\n// ---cut-after---\nconsole.log("This is not shown");\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: 'const level: string = "Danger";\n// ---cut-start---\nconsole.log(level); // This is not shown.\n// ---cut-end---\nconsole.log("This is shown");\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: "// @noImplicitAny: false\n// @target: esnext\n// @lib: esnext\n// This suppose to throw an error,\n// but it won't because we disabled noImplicitAny.\nconst fn = (a) => a + 1;\n",
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: '// @showEmit\nconst level: string = "Danger";\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: '// @declaration\n// @showEmit\n// @showEmittedFile: index.d.ts\nexport const hello = "world";\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: '// @declaration\n// @declarationMap\n// @showEmit\n// @showEmittedFile: index.d.ts.map\nexport const hello: string = "world";\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: "// @noErrors\n// This is a twoslash code block\nimport { useState } from 'react';\n// ---cut---\nfunction Counter() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(count + 1)}>\n      Count: {count}\n    </button>\n  );\n}\n",
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: '// @noErrors\n// alchemy-specific twoslash code block\nimport { createAlchemySmartAccountClient } from "@account-kit/infra";\n\nconst client = createAlchemySmartAccountClient({\n  // configuration\n});\n',
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      })]
    });
  }
  function MDXContent(props = {}) {
    const { wrapper: MDXLayout } = {
      ...useMDXComponents(),
      ...props.components
    };
    return MDXLayout ? (0, import_jsx_runtime.jsx)(MDXLayout, {
      ...props,
      children: (0, import_jsx_runtime.jsx)(_createMdxContent, {
        ...props
      })
    }) : _createMdxContent(props);
  }
  function _missingMdxReference(id, component) {
    throw new Error("Expected " + (component ? "component" : "object") + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
  }
  return __toCommonJS(mdx_bundler_entry_point__random_uuid__exports);
})();
;return Component;