import "server-only";

import { fernToken_admin } from "@fern-api/docs-server";

import { getDocsUrlMetadata } from "@/app/api/utils/getDocsUrlMetadata";

export default async function getDocsGithubUrl({
  url,
  token,
}: {
  url: string;
  token: string;
}): Promise<
  { success: true; githubUrl: string } | { success: false; error: string }
> {
  const docsUrlMetadata = await getDocsUrlMetadata({
    url: decodeURIComponent(url),
    token: fernToken_admin() ?? token,
  });
  if (!docsUrlMetadata.ok) {
    // the docs url is user-supplied (parsed from the page url) so it's ok if it
    // doesn't exist
    if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
      // Don't cache this failure, so throw to skip cache
      return { success: false, error: "DomainNotRegisteredError" };
    }

    console.error(
      "Failed to load docs URL metadata",
      JSON.stringify(docsUrlMetadata.error)
    );
    return {
      success: false,
      error: `Unable to find that domain. Please check that the domain "${decodeURIComponent(
        url
      )}" is correct.`,
    };
  }

  if (docsUrlMetadata.body.gitUrl == null) {
    // Don't cache this failure, so throw to skip cache
    return { success: false, error: "NoGitUrl" };
  }

  const [owner, repo] = docsUrlMetadata.body.gitUrl.split("/").slice(-2);
  if (owner == null || repo == null) {
    // Don't cache this failure, so throw to skip cache
    return { success: false, error: "InvalidGitUrl" };
  }

  return { success: true, githubUrl: docsUrlMetadata.body.gitUrl };
}
