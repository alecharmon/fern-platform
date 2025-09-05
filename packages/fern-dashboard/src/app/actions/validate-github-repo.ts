"use server";

import { validateGithubRepoAccess } from "@/app/services/dal/github/validators";

export async function validateGithubRepoAction(
  orgName: string,
  site: string,
  githubUrl: string
) {
  const result = await validateGithubRepoAccess(
    orgName,
    site,
    { type: "url", githubUrl },
    true // Always skip cache for polling
  );

  return result;
}
