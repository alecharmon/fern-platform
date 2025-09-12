import { HTTPSnippet, type TargetId } from "httpsnippet-lite";

import { SnippetResolver } from "@fern-api/snippets";

import { DynamicIr } from "../../client/APIV1Write";
import {
  ApiDefinition,
  CodeSnippet,
  EndpointDefinition,
  ExampleEndpointCall,
} from "../latest";
import { toSnippetHttpRequest } from "./SnippetHttpRequest";
import { convertToCurl } from "./curl";
import { getHarRequest } from "./get-har-request";

export type DynamicIRsByLanguage = Record<string, DynamicIr>;
interface HTTPSnippetClient {
  targetId: TargetId;
  clientId: string;
}

const CLIENTS: HTTPSnippetClient[] = [
  { targetId: "python", clientId: "requests" },
  { targetId: "javascript", clientId: "fetch" },
  { targetId: "go", clientId: "native" },
  { targetId: "ruby", clientId: "native" },
  { targetId: "java", clientId: "unirest" },
  { targetId: "php", clientId: "guzzle" },
  { targetId: "csharp", clientId: "restsharp" },
  { targetId: "swift", clientId: "nsurlsession" },
];

export async function backfillSnippets(
  apiDefinition: ApiDefinition,
  dynamicIr: DynamicIRsByLanguage | undefined,
  flags: {
    usesApplicationJsonInFormDataValue: boolean;
    isHttpSnippetsEnabled: boolean;
    isDynamicSnippetsEnabled: boolean;
    alwaysEnableJavaScriptFetch: boolean;
  }
): Promise<ApiDefinition> {
  return {
    ...apiDefinition,
    endpoints: await Promise.all(
      Object.entries(apiDefinition.endpoints).map(async ([id, endpoint]) => {
        let dynamicGenerators: Record<string, any> = {};
        if (dynamicIr && flags.isDynamicSnippetsEnabled) {
          dynamicGenerators = createSnippetGenerators({ endpoint, dynamicIr });
        }

        return [
          id,
          {
            ...endpoint,
            examples: await Promise.all(
              endpoint.examples?.map((example) =>
                backfillSnippetsForExample(
                  apiDefinition,
                  dynamicGenerators,
                  endpoint,
                  example,
                  flags
                )
              ) ?? []
            ),
          },
        ] as const;
      })
    ).then((entries) => Object.fromEntries(entries)),
  };
}

async function backfillSnippetsForExample(
  apiDefinition: ApiDefinition,
  dynamicGenerators: Record<string, any>,
  endpoint: EndpointDefinition,
  example: ExampleEndpointCall,
  {
    usesApplicationJsonInFormDataValue,
    isHttpSnippetsEnabled,
    alwaysEnableJavaScriptFetch,
  }: {
    usesApplicationJsonInFormDataValue: boolean;
    isHttpSnippetsEnabled: boolean;
    alwaysEnableJavaScriptFetch: boolean;
  }
): Promise<ExampleEndpointCall> {
  const snippets = { ...example.snippets };

  const pushSnippet = (snippet: CodeSnippet) => {
    (snippets[snippet.language] ??= []).push(snippet);
  };

  // Check if curl snippet exists
  if (!snippets.curl?.length) {
    const endpointAuth = endpoint.auth?.[0];
    const curlCode = convertToCurl(
      toSnippetHttpRequest(
        endpoint,
        example,
        endpointAuth != null ? apiDefinition.auths[endpointAuth] : undefined
      ),
      { usesApplicationJsonInFormDataValue }
    );
    pushSnippet({
      name: undefined,
      language: "curl",
      install: undefined,
      code: curlCode,
      generated: true,
      description: undefined,
    });
  }

  if (isHttpSnippetsEnabled) {
    const snippet = new HTTPSnippet(
      getHarRequest(endpoint, example, apiDefinition.auths, example.requestBody)
    );
    for (const { clientId, targetId } of CLIENTS) {
      /**
       * If the snippet already exists, skip it
       */
      if (snippets[targetId]?.length) {
        continue;
      }

      /**
       * If alwaysEnableJavaScriptFetch is disabled, skip generating JavaScript snippets if TypeScript snippets are available
       */
      if (
        targetId === "javascript" &&
        snippets.typescript?.length &&
        !alwaysEnableJavaScriptFetch
      ) {
        continue;
      }

      const convertedCode = await snippet.convert(targetId, clientId);
      const code =
        typeof convertedCode === "string"
          ? convertedCode
          : convertedCode != null
            ? convertedCode[0]
            : undefined;

      if (code != null) {
        pushSnippet({
          name: undefined,
          language: targetId,
          install: undefined,
          code,
          generated: true,
          description: undefined,
        });
      }
    }
  }

  for (const [language, generator] of Object.entries(dynamicGenerators)) {
    if (!generator) {
      continue;
    }

    try {
      let auth;
      const endpointAuth = endpoint.auth?.[0];
      if (endpointAuth) {
        const authDefinition = apiDefinition.auths[endpointAuth];
        if (authDefinition?.type === "bearerAuth") {
          auth = {
            type: "bearer" as const,
            token: "YOUR_TOKEN_HERE",
          };
        } else {
          auth = authDefinition;
        }
      }

      // process request body similar to getHarRequest
      let processedRequestBody = example.requestBody;
      if (
        processedRequestBody != null &&
        processedRequestBody.type === "json" &&
        processedRequestBody.value &&
        typeof processedRequestBody.value === "object"
      ) {
        const filteredValue = Object.fromEntries(
          Object.entries(processedRequestBody.value).filter(([_, valueObj]) => {
            // keep arrays and primitive values
            if (
              Array.isArray(valueObj) ||
              typeof valueObj !== "object" ||
              valueObj == null
            ) {
              return true;
            }
            // for objects, only filter out empty objects without a value property
            return Object.keys(valueObj).length > 0;
          })
        );
        processedRequestBody = {
          ...processedRequestBody,
          value: filteredValue,
        };
      }

      const request = {
        baseURL:
          endpoint?.environments?.find(
            (env) => env.id === endpoint.defaultEnvironment
          )?.baseUrl ?? endpoint?.environments?.[0]?.baseUrl,
        auth,
        pathParameters: example.pathParameters,
        queryParameters: example.queryParameters,
        headers: example.headers,
        requestBody: processedRequestBody,
        method: endpoint.method,
      };

      const result = generator.generateSync(request);

      if (result?.snippet) {
        snippets[language] = [
          {
            name: undefined,
            language,
            install: undefined,
            code: result.snippet,
            generated: true,
            description: undefined,
          },
        ];
      }
    } catch (error) {
      console.error(`Error generating ${language} snippet:`, error);
    }
  }

  return { ...example, snippets };
}

function createSnippetGenerators({
  endpoint,
  dynamicIr,
}: {
  endpoint: EndpointDefinition;
  dynamicIr: DynamicIRsByLanguage;
}) {
  const snippetInputs = [];
  const generators: Record<string, any> = {};

  // only process languages that have IR data
  if (dynamicIr.typescript) {
    snippetInputs.push({
      language: "typescript" as const,
      ir: dynamicIr.typescript as any,
    });
  }

  if (dynamicIr.python) {
    snippetInputs.push({
      language: "python" as const,
      ir: dynamicIr.python as any,
    });
  }

  if (dynamicIr.java) {
    snippetInputs.push({
      language: "java" as const,
      ir: dynamicIr.java as any,
    });
  }

  if (dynamicIr.ruby) {
    snippetInputs.push({
      language: "ruby" as const,
      ir: dynamicIr.ruby as any,
    });
  }

  if (dynamicIr.csharp) {
    snippetInputs.push({
      language: "csharp" as const,
      ir: dynamicIr.csharp as any,
    });
  }

  if (dynamicIr.go) {
    snippetInputs.push({
      language: "go" as const,
      ir: dynamicIr.go as any,
    });
  }

  if (dynamicIr.php) {
    snippetInputs.push({
      language: "php" as const,
      ir: dynamicIr.php as any,
    });
  }

  const snippetResolver = new SnippetResolver({ snippetInputs });

  const endpointPath = `${endpoint.method} ${endpoint.path
    .map((p) => {
      if (p.type === "pathParameter") {
        return `{${p.value}}`;
      }
      return p.value;
    })
    .join("")}`;

  if (dynamicIr.typescript) {
    const typescriptSdk = snippetResolver.sdk("typescript");
    generators.typescript = typescriptSdk?.endpoint(endpointPath);
  }

  if (dynamicIr.python) {
    const pythonSdk = snippetResolver.sdk("python");
    generators.python = pythonSdk?.endpoint(endpointPath);
  }

  if (dynamicIr.java) {
    const javaSdk = snippetResolver.sdk("java");
    generators.java = javaSdk?.endpoint(endpointPath);
  }

  if (dynamicIr.ruby) {
    const rubySdk = snippetResolver.sdk("ruby");
    generators.ruby = rubySdk?.endpoint(endpointPath);
  }

  if (dynamicIr.csharp) {
    const csharpSdk = snippetResolver.sdk("csharp");
    generators.csharp = csharpSdk?.endpoint(endpointPath);
  }

  if (dynamicIr.go) {
    const goSdk = snippetResolver.sdk("go");
    generators.go = goSdk?.endpoint(endpointPath);
  }

  if (dynamicIr.php) {
    const phpSdk = snippetResolver.sdk("php");
    generators.php = phpSdk?.endpoint(endpointPath);
  }

  return generators;
}
