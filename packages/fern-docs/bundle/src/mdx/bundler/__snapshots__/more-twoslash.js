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
    "title": "Filename"
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
          code: "// @filename: a.ts\nexport const helloWorld: string = 'Hi'\n// ---cut---\n// @filename: b.ts\nimport { helloWorld } from './a'\n\nconsole.log(helloWorld)\n",
          className: "language-ts",
          language: "ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: `<Markdown src="./file-a.mdx" />
// ---cut---
// @filename: b.ts
import { helloWorld } from './a'

console.log(helloWorld)
`,
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