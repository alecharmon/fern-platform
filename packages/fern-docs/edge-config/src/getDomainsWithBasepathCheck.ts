import { getEdge } from "./getEdge";

export async function getDomainsWithBasepathCheck(): Promise<string[] | undefined> {
    return getEdge<string[]>("domains-with-upstash-basepath-check");
}
