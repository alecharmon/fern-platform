import { FernVenusApiClient } from "@fern-api/venus-api-sdk";

export function getVenusClient({ token }: { token: string }): FernVenusApiClient {
    const venusUrl = process.env.NEXT_PUBLIC_VENUS_URL ?? process.env.VENUS_URL ?? "https://venus.buildwithfern.com";
    return new FernVenusApiClient({
        environment: venusUrl,
        token
    });
}
