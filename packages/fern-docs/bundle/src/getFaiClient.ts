import { FernAIClient } from "@fern-api/fai-sdk";

export function getFaiClient({ token }: { token: string }): FernAIClient {
  return new FernAIClient({
    baseUrl: process.env.FAI_SERVER_URL ?? "https://fai.buildwithfern.com",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
