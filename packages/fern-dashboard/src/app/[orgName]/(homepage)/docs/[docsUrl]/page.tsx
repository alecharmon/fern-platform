import "server-only";

import { notFound } from "next/navigation";

import getGithubSourceMetadataHandler from "@/app/api/get-github-source-metadata/handler";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import getDocsGithubUrl from "@/app/services/dal/github/getDocsGithubUrl";
import { validateGithubRepoAccess } from "@/app/services/dal/github/validators";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import { FernCliVersionDisplay } from "@/components/docs-page/FernCliVersionDisplay";
import {
  GithubAuthState,
  GithubSource,
} from "@/components/docs-page/GithubSource";
import { VisualEditorSection } from "@/components/docs-page/visual-editor-section/VisualEditorSection";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export const dynamic = "force-dynamic";
export const experimental_ppr = true;

export default async function Page(props: {
  params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
  const { orgName, docsUrl: encodedDocsUrl } = await props.params;

  const session = await getAuthenticatedSessionOrRedirect(orgName);
  const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

  // Validate that the docsUrl belongs to this organization so that we avoid errors in the page
  const docsSites = await getDocsSitesForOrg({
    orgName,
    token: session.accessToken,
  });
  if (!docsSites.ok) {
    notFound();
  }
  const currentDocsSite = docsSites.docsSites.find(
    (site) => getDocsSiteUrl(site) === docsUrl
  );
  if (currentDocsSite == null) {
    notFound();
  }

  let githubUrl = undefined;
  let githubAuthState: GithubAuthState = {
    validationResult: {
      ok: false,
      error: {
        type: "UNEXPECTED_ERROR",
        message: "",
      },
    },
    sourceRepo: undefined,
    isLoading: false,
  };

  try {
    const urlResult = await getDocsGithubUrl({
      url: encodedDocsUrl,
      token: session.accessToken,
    });

    if (!urlResult.success) {
      if (urlResult.error.type === "DOMAIN_NOT_REGISTERED") {
        githubAuthState.validationResult = {
          ok: false,
          error: {
            type: "UNEXPECTED_ERROR",
            message: "Domain not registered.",
          },
        };
      } else {
        githubAuthState.validationResult = {
          ok: false,
          error: urlResult.error,
        };
      }
    } else {
      githubUrl = urlResult.githubUrl;

      try {
        const validation = await validateGithubRepoAccess(
          orgName,
          docsUrl,
          {
            type: "url",
            githubUrl,
          },
          true // Skip cache so that we can force re-fetch on page load
        );

        let sourceRepo = undefined;

        // If user has all required access, fetch the source repo metadata
        if (validation.ok) {
          try {
            sourceRepo = await getGithubSourceMetadataHandler({
              githubUrl,
              userId: session.user.sub,
            });
          } catch (error) {
            console.error("Failed to fetch source repo metadata:", error);
          }
        }

        githubAuthState = {
          validationResult: validation,
          sourceRepo,
          isLoading: false,
        };
      } catch (error) {
        console.error("Failed to validate GitHub access:", error);
        // Keep default false state
      }
    }
  } catch (error) {
    console.error(error);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <DocsSiteOverviewCard
        docsSite={currentDocsSite}
        githubProtectedArea={
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div className="flex w-fit flex-col gap-2">
              <p>Source</p>
              <GithubSource docsUrl={docsUrl} githubUrl={githubUrl} />
            </div>
            <FernCliVersionDisplay
              orgName={orgName}
              docsUrl={docsUrl}
              githubUrl={githubUrl}
              baseBranch={githubAuthState.sourceRepo?.baseBranch}
            />
          </div>
        }
      />
      <VisualEditorSection
        docsUrl={docsUrl}
        session={session}
        orgName={orgName}
        githubAuthState={githubAuthState}
        githubUrl={githubUrl}
      />
    </div>
  );
}
