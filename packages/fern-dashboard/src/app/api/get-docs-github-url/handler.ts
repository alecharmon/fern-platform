import type { DocsUrl } from "@/utils/types";

import { getDocsGitUrl } from "../../services/dal/github/getDocsGitUrl";

export default async function getDocsGitUrlHandler({ docsUrl, token }: { docsUrl: DocsUrl; token: string }) {
    return await getDocsGitUrl(docsUrl, token);
}
