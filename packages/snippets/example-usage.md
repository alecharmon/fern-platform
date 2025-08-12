```ts
import { dynamic, generatorExec } from "@fern-api/dynamic-ir-sdk/api";

import { SnippetInput, SnippetResolver } from "./src/index";

// Example of how to use the updated SnippetResolver
async function example() {
  // Create snippet inputs with your dynamic IRs and configs
  const snippetInputs: SnippetInput[] = [
    {
      language: "typescript",
      ir: {} as dynamic.DynamicIntermediateRepresentation, // Your TypeScript IR here
      config: {} as generatorExec.config.GeneratorConfig, // Your TypeScript config here
    },
    {
      language: "python",
      ir: {} as dynamic.DynamicIntermediateRepresentation, // Your Python IR here
      config: {} as generatorExec.config.GeneratorConfig, // Your Python config here
    },
  ];

  // Create the resolver with your inputs
  const resolver = new SnippetResolver({ snippetInputs });

  // Use it to get snippets for different languages
  const typescriptSdk = resolver.sdk("typescript");
  const pythonSdk = resolver.sdk("python");

  // Generate snippets for specific endpoints
  const typescriptSnippet = typescriptSdk.endpoint("GET /users");
  const pythonSnippet = pythonSdk.endpoint("GET /users");
}

export { example };
```
