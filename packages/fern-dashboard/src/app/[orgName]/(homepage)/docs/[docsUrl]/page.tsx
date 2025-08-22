import "server-only";

import Image from "next/image";
import { redirect } from "next/navigation";

import getGithubSourceMetadataHandler from "@/app/api/get-github-source-metadata/handler";
import getMyDocsSitesHandler from "@/app/api/get-my-docs-sites/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsGithubUrl from "@/app/services/dal/github/getDocsGithubUrl";
import { validateGithubRepoAccess } from "@/app/services/dal/github/validators";
import { GithubLogo } from "@/components/auth/GithubLogo";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import {
  GithubAuthState,
  GithubSource,
} from "@/components/docs-page/GithubSource";
import { GoToEditorButton } from "@/components/docs-page/GoToEditorButton";
import { WarningNote } from "@/components/docs-page/WarningNote";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export default async function Page(props: {
  params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
  // Validate session
  const session = await getCurrentSession();
  if (session == null) {
    redirect("/");
  }

  const { orgName, docsUrl: encodedDocsUrl } = await props.params;
  const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });

  // Validate that the docsUrl belongs to this organization so that we avoid errors in the page
  try {
    const docsSites = await getMyDocsSitesHandler({
      orgName,
      token: session.accessToken,
    });

    const docsUrlsInOrg = docsSites.docsSites.map((site) =>
      getDocsSiteUrl(site)
    );
    const isValidDocsUrl = docsUrlsInOrg.includes(docsUrl);

    if (!isValidDocsUrl) {
      redirect(`/${orgName}/docs`);
    }
  } catch (error) {
    console.error("Failed to validate docs url", error);
    // If we can't validate (e.g., permission issues), redirect to docs overview
    redirect(`/${orgName}/docs`);
  }

  let githubUrl = undefined;
  let githubAuthState: GithubAuthState = {
    repoExists: false,
    hasWriteAccess: false,
    hasFernBotInstalled: false,
    sourceRepo: undefined,
    isLoading: false,
  };

  try {
    const urlResult = await getDocsGithubUrl({
      url: encodedDocsUrl,
      token: session.accessToken,
    });

    githubUrl = urlResult.success ? urlResult.githubUrl : undefined;

    // If we have a GitHub URL, validate the auth state
    if (githubUrl) {
      try {
        const validation = await validateGithubRepoAccess(session.user.sub, {
          type: "url",
          githubUrl,
        });

        let sourceRepo = undefined;

        // If user has all required access, fetch the source repo metadata
        if (
          validation.repoExists &&
          validation.hasWriteAccess &&
          validation.hasFernBotInstalled
        ) {
          try {
            sourceRepo = await getGithubSourceMetadataHandler({
              githubUrl,
              userId: session.user.sub,
              skipCache: false,
            });
          } catch (error) {
            console.error("Failed to fetch source repo metadata:", error);
          }
        }

        githubAuthState = {
          repoExists: validation.repoExists,
          hasWriteAccess: validation.hasWriteAccess,
          hasFernBotInstalled: validation.hasFernBotInstalled,
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
    <FeatureFlaggedServerSide
      flag={PosthogFeatureFlag.ENABLE_DOCS_PAGE}
      redirectWhenDisabled
      orgName={orgName}
    >
      <div className="flex w-full flex-col gap-4">
        <DocsSiteOverviewCard
          docsUrl={docsUrl}
          githubProtectedArea={
            <div className="flex w-fit flex-col gap-2">
              <p>Source</p>
              <GithubSource docsUrl={docsUrl} githubUrl={githubUrl} />
            </div>
          }
        />

        <Card className="p-0! relative flex h-[300px] flex-col-reverse gap-0 lg:flex-row">
          <div className="lg:max-w-1/2 h-full w-full">
            <Image
              src="/ve_empty.avif"
              alt="Docs Preview"
              width={2000}
              height={2000}
              className="h-full w-auto object-contain object-bottom"
            />
          </div>
          <div className="flex flex-col items-center justify-center gap-4 p-6 md:flex-1 lg:items-start">
            <div className="flex flex-col items-center lg:items-start">
              <p className="text-lg font-semibold">Fern Visual Editor</p>
              <p className="text-muted-foreground text-sm">
                Modify your documentation without touching code.
              </p>
            </div>

            {!githubAuthState.hasFernBotInstalled ? (
              <>
                <p className="text-muted-foreground text-sm">
                  To get started, install the Fern app on your GitHub
                  repository.
                </p>
                <Button asChild>
                  <a
                    href="https://github.com/apps/fern-api"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GithubLogo />
                    Install
                  </a>
                </Button>
              </>
            ) : !githubAuthState.hasWriteAccess ? (
              <WarningNote>
                You do not have write access to this repo. Contact your Github
                admin.
              </WarningNote>
            ) : !githubAuthState.repoExists ? (
              <WarningNote>
                This repo was not found. Please check that the repo exists and
                that you have access to it.
              </WarningNote>
            ) : (
              <>
                <GoToEditorButton
                  orgName={orgName}
                  docsUrl={docsUrl}
                  session={session}
                  sourceRepo={githubAuthState.sourceRepo}
                />
                <p className="text-muted-foreground text-sm">
                  All sessions will turn into PRs in your Github repo{" "}
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary underline transition-colors"
                  >
                    here
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </FeatureFlaggedServerSide>
  );
}
