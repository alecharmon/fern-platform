import type { DocsUrl } from "@/utils/types";

import { getDocsGithubUrl } from "../../services/dal/github/getDocsGithubUrl";

export default async function getDocsGithubUrlHandler({ docsUrl, token }: { docsUrl: DocsUrl; token: string }) {
    return await getDocsGithubUrl(docsUrl, token);
}
