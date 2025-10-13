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
  var frontmatter = void 0;
  function _createMdxContent(props) {
    const _components = {
      a: "a",
      code: "code",
      li: "li",
      p: "p",
      ul: "ul",
      ...useMDXComponents(),
      ...props.components
    }, { Accordion, AccordionGroup, CodeBlock, CodeGroup, ErrorBoundary, Info } = _components;
    if (!Accordion) _missingMdxReference("Accordion", true);
    if (!AccordionGroup) _missingMdxReference("AccordionGroup", true);
    if (!CodeBlock) _missingMdxReference("CodeBlock", true);
    if (!CodeGroup) _missingMdxReference("CodeGroup", true);
    if (!ErrorBoundary) _missingMdxReference("ErrorBoundary", true);
    if (!Info) _missingMdxReference("Info", true);
    return (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
      children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(Info, {
          children: "Required SDK version: ^v4.61.0"
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(Info, {
          children: (0, import_jsx_runtime.jsxs)(_components.p, {
            children: ["Full SDK support is coming soon! For now, this guide uses ", (0, import_jsx_runtime.jsx)(_components.code, {
              children: "fetch"
            }), " to fetch the\nswap quote."]
          })
        })
      }), "\n", (0, import_jsx_runtime.jsx)(_components.p, {
        children: "You\u2019ll need the following env variables:"
      }), "\n", (0, import_jsx_runtime.jsxs)(_components.ul, {
        children: ["\n", (0, import_jsx_runtime.jsxs)(_components.li, {
          children: [(0, import_jsx_runtime.jsx)(_components.code, {
            children: "ALCHEMY_API_KEY"
          }), ": An ", (0, import_jsx_runtime.jsx)(_components.a, {
            href: "https://dashboard.alchemy.com/apps",
            children: "Alchemy API Key"
          })]
        }), "\n", (0, import_jsx_runtime.jsxs)(_components.li, {
          children: [(0, import_jsx_runtime.jsx)(_components.code, {
            children: "ALCHEMY_POLICY_ID"
          }), ": A ", (0, import_jsx_runtime.jsx)(_components.a, {
            href: "https://dashboard.alchemy.com/gas-manager/policy/create",
            children: "Gas Manager"
          }), " policy ID"]
        }), "\n", (0, import_jsx_runtime.jsxs)(_components.li, {
          children: [(0, import_jsx_runtime.jsx)(_components.code, {
            children: "PRIVATE_KEY"
          }), ": A private key for a signer"]
        }), "\n"]
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsxs)(CodeGroup, {
          children: [(0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: 'import { client, config } from "./client.ts";\n\ninterface SwapQuoteResponse {\n  id: number;\n  jsonrpc: "2.0";\n  result?: {\n    quote: {\n      minimumToAmount: Hex;\n      expiry: Hex;\n    };\n    type: string;\n    data: any;\n    signatureRequest: any;\n  };\n  error?: {\n    code: number;\n    message: string;\n  };\n}\n\nconst quoteRequest = {\n  method: "wallet_requestQuote_v0" as const,\n  params: [\n    {\n      from: client.account!.address,\n      chainId: "CHAIN_ID",\n      fromToken: "FROM_TOKEN",\n      toToken: "TO_TOKEN",\n      fromAmount: "FROM_AMOUNT", // You can pass a `minimumToAmount` instead to ensure you get a minimum output from the swap\n      // postCalls: [ // You can uncomment this block to batch calls after the swap!\n      //   {\n      //     to: "0x...",\n      //     data: "0x...",\n      //     value: "0x...",\n      //   },\n      // ],\n      capabilities: {\n        paymasterService: {\n          policyId: config.paymasterPolicyId,\n        },\n      },\n      // slippage: "0x32", // Optional: 50 (0.5% slippage tolerance, 0x32) is the default\n    },\n  ],\n};\n\nlet response: Response = await fetch(\n  `https://api.g.alchemy.com/v2/${alchemyApiKey}`,\n  {\n    method: "POST",\n    headers: {\n      "Content-Type": "application/json",\n    },\n    body: JSON.stringify({\n      id: 1,\n      jsonrpc: "2.0",\n      ...quoteRequest,\n    }),\n  }\n);\n\nconst quoteResponse = (await response.json()) as SwapQuoteResponse;\n\nconsole.log("Quote: ", quoteResponse.result!.quote);\n\n// Build the input for signing the calls\nconst signInput = {\n  type: quoteResponse.result!.type,\n  data: quoteResponse.result!.data,\n  signatureRequest: quoteResponse.result!.signatureRequest,\n};\n\n// Sign the quote, getting back prepared and signed calls\nconst signedCalls = await client.signPreparedCalls(signInput as any);\n\n// Send the prepared calls\nconst sendResult = await client.sendPreparedCalls(signedCalls);\n\n// Wait for the call to resolve\nconst callStatusResults = await client.waitForCallsStatus({\n  id: sendResult.preparedCallIds[0]!,\n});\n\n// Filter through potential failure cases\nif (\n  callStatusResult.status !== "success" ||\n  !callStatusResult.receipts ||\n  !callStatusResult.receipts[0]\n) {\n  throw new Error(\n    `Transaction failed with status ${callStatusResult.status}, full receipt:\\n ${JSON.stringify(callStatusResult, null, 2)}`\n  );\n}\n\nconsole.log("Swap confirmed!");\nconsole.log(\n  `Transaction hash: ${callStatusResult.receipts[0].transactionHash}`\n);\n',
              className: "language-ts",
              language: "ts",
              twoslash: true,
              title: "requestQuote.ts"
            })
          }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsx)(CodeBlock, {
              code: 'import { LocalAccountSigner } from "@aa-sdk/core";\nimport { alchemy, sepolia } from "@account-kit/infra";\nimport { createSmartWalletClient } from "@account-kit/wallet-client";\nimport "dotenv/config";\nimport { type Address, type Hex, toHex } from "viem";\n\nexport const config = {\n  policyId: process.env.ALCHEMY_POLICY_ID!,\n};\n\nconst clientParams = {\n  transport: alchemy({\n    apiKey: process.env.ALCHEMY_API_KEY!,\n  }),\n  chain: sepolia,\n  signer: LocalAccountSigner.privateKeyToAccountSigner(\n    process.env.PRIVATE_KEY! as Hex\n  ),\n};\n\nconst clientWithoutAccount = createSmartWalletClient(clientParams);\n\nconst account = await clientWithoutAccount.requestAccount();\n\nexport const client = createSmartWalletClient({\n  ...clientParams,\n  account: account.address,\n});\n',
              className: "language-ts",
              language: "ts",
              twoslash: true,
              title: "client.ts"
            })
          })]
        })
      }), "\n", (0, import_jsx_runtime.jsx)(ErrorBoundary, {
        children: (0, import_jsx_runtime.jsx)(AccordionGroup, {
          children: (0, import_jsx_runtime.jsx)(ErrorBoundary, {
            children: (0, import_jsx_runtime.jsxs)(Accordion, {
              title: "Full Example",
              id: "full-example",
              nestedHeaders: [],
              children: [(0, import_jsx_runtime.jsx)(_components.p, {
                children: "This example swaps 0.01 USDC for DAI on Arbitrum, and includes additional error handling."
              }), (0, import_jsx_runtime.jsx)(ErrorBoundary, {
                children: (0, import_jsx_runtime.jsx)(CodeBlock, {
                  code: '/**\n * Note: This uses direct fetch calls as the swap feature is not yet\n * available in @account-kit/wallet-client. Once available, you\'ll be\n * able to use the wallet client instead!\n *\n * Complete example: Swap 0.01 DAI for USDC on Arbitrum\n * Prerequisites:\n * - PRIVATE_KEY: Your EOA private key (as usual, any signer will do the trick here!)\n * - ALCHEMY_API_KEY: Your Alchemy API key\n * - PAYMASTER_POLICY_ID: Your paymaster policy ID for gas sponsorship\n */\nimport { LocalAccountSigner } from "@aa-sdk/core";\nimport { alchemy, arbitrum } from "@account-kit/infra";\nimport { createSmartWalletClient } from "@account-kit/wallet-client";\nimport { type Hex, fromHex } from "viem";\nimport { privateKeyToAccount } from "viem/accounts";\n\n// Common token addresses on Arbitrum\nconst TOKENS = {\n  DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",\n  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",\n  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEee",\n  // Add more as needed\n} as const;\n\n// Type definitions for the swap quote response, which is temporary until\n// the swap feature is available in @account-kit/wallet-client\ninterface SwapQuoteResponse {\n  id: number;\n  jsonrpc: "2.0";\n\n  result?: {\n    quote: {\n      minimumToAmount: Hex;\n      expiry: Hex;\n    };\n    type: string;\n    data: any;\n    signatureRequest: any;\n  };\n  error?: {\n    code: number;\n    message: string;\n  };\n}\n\n// Check environment variables\nif (!process.env.PRIVATE_KEY) {\n  throw new Error("PRIVATE_KEY environment variable is not set");\n}\n\nconst alchemyApiKey = process.env.ALCHEMY_API_KEY;\nif (!alchemyApiKey) {\n  throw new Error("ALCHEMY_API_KEY environment variable is not set");\n}\n\nconst paymasterPolicyId = process.env.PAYMASTER_POLICY_ID;\nif (!paymasterPolicyId) {\n  throw new Error("PAYMASTER_POLICY_ID environment variable is not set");\n}\n\n// Step 1: Create a signer\nconst signer = LocalAccountSigner.privateKeyToAccountSigner(\n  process.env.PRIVATE_KEY as `0x${string}`\n);\n\n// Step 2: Create a wallet client\nconst walletClientWithoutAccount = createSmartWalletClient({\n  transport: alchemy({\n    apiKey: alchemyApiKey,\n  }),\n  chain: arbitrum,\n  signer,\n});\n\n// Step 3: Get account\nconst account = await walletClientWithoutAccount.requestAccount();\nconsole.log("Smart wallet address:", account.address);\n\nconst walletClient = createSmartWalletClient({\n  account: account.address,\n  transport: alchemy({\n    apiKey: alchemyApiKey,\n  }),\n  chain: arbitrum,\n  signer,\n});\n\n// Step 4: Create swap quote request\n// Note: Amount values are in wei (smallest unit)\n// 0x2386F26FC10000 = 0.01 DAI (10^16 wei)\n//\n// Option A: Swap exact amount of source token (fromAmount)\n// Option B: Get minimum destination amount (uncomment minimumToAmount)\nconst quoteRequest = {\n  method: "wallet_requestQuote_v0" as const,\n  params: [\n    {\n      from: walletClient.account!.address,\n      chainId: "0xa4b1", // Arbitrum chain ID (42161 in hex)\n      fromToken: TOKENS.DAI,\n      toToken: TOKENS.USDC,\n      fromAmount: "0x2386F26FC10000", // Swap exactly 0.01 DAI\n      minimumToAmount: "0x2710", // OR: Get at least 0.01 USDC (uncomment to use this flow)\n      capabilities: {\n        paymasterService: {\n          policyId: paymasterPolicyId,\n        },\n      },\n      slippage: "0x0a", // 10 (0.1% slippage), the default is 50 (0.5% slippage) or 0x32\n    },\n  ],\n};\n\n// Step 5: Request the quote using fetch\ntry {\n  console.log("Requesting swap quote...");\n\n  const fullRequest = {\n    id: 1,\n    jsonrpc: "2.0",\n    ...quoteRequest,\n  };\n\n  const response = await fetch(\n    `https://api.g.alchemy.com/v2/${alchemyApiKey}`,\n    {\n      method: "POST",\n      headers: {\n        "Content-Type": "application/json",\n      },\n      body: JSON.stringify(fullRequest),\n    }\n  );\n\n  if (!response.ok) {\n    const errorText = await response.text();\n    console.error("Quote request failed:", errorText);\n    throw new Error(`Quote request failed (${response.status}): ${errorText}`);\n  }\n\n  const quoteResponse = (await response.json()) as SwapQuoteResponse;\n\n  // Check for RPC errors\n  if (quoteResponse.error) {\n    throw new Error(`RPC Error: ${quoteResponse.error.message}`);\n  }\n\n  if (!quoteResponse.result) {\n    throw new Error("No result in quote response");\n  }\n  console.log(\n    "Quote received successfully, minimum amount to receive:",\n    fromHex(quoteResponse.result.quote.minimumToAmount, "bigint")\n  );\n\n  // Step 6: Sign the quote data\n  const signInput = {\n    type: quoteResponse.result.type,\n    data: quoteResponse.result.data,\n    signatureRequest: quoteResponse.result.signatureRequest,\n  };\n\n  console.log("Signing swap transaction...");\n  // Type casting needed until SDK types are updated!\n  const signedCalls = await walletClient.signPreparedCalls(signInput as any);\n\n  // Step 7: Send the transaction\n  console.log("Sending swap transaction...");\n  const sendResult = await walletClient.sendPreparedCalls(signedCalls);\n\n  // Validate prepared call ID\n  if (sendResult.preparedCallIds.length !== 1) {\n    throw new Error(\n      `Expected exactly 1 prepared call ID, but got ${sendResult.preparedCallIds.length}`\n    );\n  }\n\n  // Log the transaction result\n  console.log("Swap transaction submitted:", sendResult);\n\n  // Step 8: Poll for transaction status\n  const callStatusResult = await walletClient.waitForCallsStatus({\n    id: sendResult.preparedCallIds[0]!,\n  });\n\n  if (\n    callStatusResult.status !== "success" ||\n    !callStatusResult.receipts ||\n    !callStatusResult.receipts[0]\n  ) {\n    throw new Error(\n      `Transaction failed with status ${callStatusResult.status}, full receipt:\\n ${JSON.stringify(callStatusResult, null, 2)}`\n    );\n  }\n\n  console.log("Swap confirmed!");\n  console.log(\n    `Transaction hash: ${callStatusResult.receipts[0].transactionHash}`\n  );\n  console.log(\n    `View on Arbiscan: https://arbiscan.io/tx/${callStatusResult.receipts[0]?.transactionHash}`\n  );\n} catch (error) {\n  console.error("Error during swap:", error);\n  process.exit(1);\n}\n',
                  className: "language-ts",
                  language: "ts",
                  twoslash: true
                })
              })]
            })
          })
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