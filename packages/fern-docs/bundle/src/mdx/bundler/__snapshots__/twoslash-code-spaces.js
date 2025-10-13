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
    "title": "Spaces",
    "description": "Get started with Alchemy's ERC-4337 infrastructure"
  };
  function _createMdxContent(props) {
    const _components = {
      h2: "h2",
      ...useMDXComponents(),
      ...props.components
    }, { CodeBlock, CodeGroup, ErrorBoundary } = _components;
    if (!CodeBlock) _missingMdxReference("CodeBlock", true);
    if (!CodeGroup) _missingMdxReference("CodeGroup", true);
    if (!ErrorBoundary) _missingMdxReference("ErrorBoundary", true);
    return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
      children: [(0, import_jsx_runtime.jsx)(_components.h2, {
        id: "leave-this-content",
        children: "Leave this content"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsxs)(CodeGroup, {
          children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: "yarn add @account-kit/infra @account-kit/smart-contracts\n",
              className: "language-bash",
              language: "bash",
              title: "yarn"
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: "npm i -s @account-kit/infra @account-kit/smart-contracts\n",
              className: "language-bash",
              language: "bash",
              title: "npm"
            })
          })]
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h2, {
        id: "leave-the-first-change-the-second",
        children: "Leave the first, change the second"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsxs)(CodeGroup, {
          children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: "yarn add @account-kit/infra @account-kit/smart-contracts\n",
              className: "language-bash",
              language: "bash",
              title: "yarn"
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: "npm i -s @account-kit/infra @account-kit/smart-contracts\n",
              className: "language-bash",
              language: "bash",
              title: "npm"
            })
          })]
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: 'import { client } from "./client";\n\nconst { hash } = await client.sendUserOperation({\n  uo: {\n    target: "0xTARGET_ADDRESS",\n    data: "0x",\n    value: 0n,\n  },\n});\n',
          className: "language-ts",
          language: "ts",
          twoslash: true,
          title: "example.ts"
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h2, {
        id: "remove-codeblocks-single",
        children: "Remove CodeBlocks single"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeGroup, {
          children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: `// You can replace this with any signer you'd like
// We're using a LocalAccountSigner to generate a local key to sign with
import { LocalAccountSigner } from "@aa-sdk/core";
import {
  alchemy,
  createAlchemySmartAccountClient,
  sepolia,
} from "@account-kit/infra";
import { createLightAccount } from "@account-kit/smart-contracts";
import { generatePrivateKey } from "viem/accounts";

const alchemyTransport = alchemy({
  apiKey: "YOUR_API_KEY",
});

export const client = createAlchemySmartAccountClient({
  transport: alchemyTransport,
  policyId: "YOUR_POLICY_ID",
  chain: sepolia,
  account: await createLightAccount({
    chain: sepolia,
    transport: alchemyTransport,
    signer: LocalAccountSigner.privateKeyToAccountSigner(generatePrivateKey()),
  }),
});
`,
              className: "language-ts",
              language: "ts",
              twoslash: true,
              title: "client.ts"
            })
          })
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h2, {
        id: "remove-codeblocks-double",
        children: "Remove CodeBlocks double"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsxs)(CodeGroup, {
          children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: 'import { client } from "./client";\n\nconst { hash } = await client.sendUserOperation({\n  uo: {\n    target: "0xTARGET_ADDRESS",\n    data: "0x",\n    value: 0n,\n  },\n});\n',
              className: "language-ts",
              language: "ts",
              twoslash: true,
              title: "example.ts"
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: `// You can replace this with any signer you'd like
// We're using a LocalAccountSigner to generate a local key to sign with
import { LocalAccountSigner } from "@aa-sdk/core";
import {
  alchemy,
  createAlchemySmartAccountClient,
  sepolia,
} from "@account-kit/infra";
import { createLightAccount } from "@account-kit/smart-contracts";
import { generatePrivateKey } from "viem/accounts";

const alchemyTransport = alchemy({
  apiKey: "YOUR_API_KEY",
});

export const client = createAlchemySmartAccountClient({
  transport: alchemyTransport,
  policyId: "YOUR_POLICY_ID",
  chain: sepolia,
  account: await createLightAccount({
    chain: sepolia,
    transport: alchemyTransport,
    signer: LocalAccountSigner.privateKeyToAccountSigner(generatePrivateKey()),
  }),
});
`,
              className: "language-ts",
              language: "ts",
              twoslash: true,
              title: "client.ts"
            })
          })]
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h2, {
        id: "remove-codeblocks-mixed",
        children: "Remove CodeBlocks mixed"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsxs)(CodeGroup, {
          children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: 'import { createWalletClient, http } from "viem";\nimport { sepolia } from "viem/chains";\n\nimport { signer } from "./signer";\n\nexport const walletClient = createWalletClient({\n  transport: http("alchemy_rpc_url"),\n  chain: sepolia,\n  account: signer.toViemAccount(),\n});\n',
              className: "language-ts",
              language: "ts",
              title: "createWalletClient.ts",
              twoslash: true
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: "yarn add @account-kit/infra @account-kit/smart-contracts\n",
              className: "language-bash",
              language: "bash",
              title: "yarn"
            })
          })]
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.h2, {
        id: "other-order",
        children: "Other order"
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: 'import { client } from "./client";\n\nconst { hash } = await client.sendUserOperation({\n  uo: {\n    target: "0xTARGET_ADDRESS",\n    data: "0x",\n    value: 0n,\n  },\n});\n',
          className: "language-ts",
          language: "ts",
          title: "example.ts",
          twoslash: true
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(CodeBlock, {
          code: `// You can replace this with any signer you'd like
// We're using a LocalAccountSigner to generate a local key to sign with
import { LocalAccountSigner } from "@aa-sdk/core";
import {
  alchemy,
  createAlchemySmartAccountClient,
  sepolia,
} from "@account-kit/infra";
import { createLightAccount } from "@account-kit/smart-contracts";
import { generatePrivateKey } from "viem/accounts";

const alchemyTransport = alchemy({
  apiKey: "YOUR_API_KEY",
});

export const client = createAlchemySmartAccountClient({
  transport: alchemyTransport,
  policyId: "YOUR_POLICY_ID",
  chain: sepolia,
  account: await createLightAccount({
    chain: sepolia,
    transport: alchemyTransport,
    signer: LocalAccountSigner.privateKeyToAccountSigner(generatePrivateKey()),
  }),
});
`,
          className: "language-ts",
          language: "ts",
          title: "client.ts",
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