import { getPostmanBaseUrl } from "./jwt";

export async function fetchPostmanCollection(
    accessToken: string,
    collectionId: string
): Promise<Record<string, unknown>> {
    const baseUrl = getPostmanBaseUrl();
    const response = await fetch(`${baseUrl}/collections/${collectionId}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to fetch collection ${collectionId}: ${body}`);
    }

    const data = (await response.json()) as { collection: Record<string, unknown> };
    return data.collection;
}
