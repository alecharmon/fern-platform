import "server-only";

import { redirect } from "next/navigation";

import getGithubSourceMetadataHandler from "@/app/api/get-github-source-metadata/handler";
import getMyDocsSitesHandler from "@/app/api/get-my-docs-sites/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsGithubUrl from "@/app/services/dal/github/getDocsGithubUrl";
import {
  GithubRepoValidationError,
  validateGithubRepoAccess,
} from "@/app/services/dal/github/validators";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import { BetaBadge } from "@/components/docs-page/BetaBadge";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import {
  GithubAuthState,
  GithubSource,
} from "@/components/docs-page/GithubSource";
import { GoToEditorButton } from "@/components/docs-page/GoToEditorButton";
import { InstallGithubAppButton } from "@/components/docs-page/InstallGithubAppButton";
import { VEPreviewImage } from "@/components/docs-page/VEPreviewImage";
import { WarningNote } from "@/components/docs-page/WarningNote";
import Card from "@/components/ui/card";
import { getValidationErrorMessage } from "@/utils/errors";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export const dynamic = "force-dynamic";

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

    githubUrl = urlResult.success ? urlResult.githubUrl : undefined;

    // If we have a GitHub URL, validate the auth state
    if (githubUrl) {
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
        docsUrl={docsUrl}
        githubProtectedArea={
          <div className="flex w-fit flex-col gap-2">
            <p>Source</p>
            <GithubSource docsUrl={docsUrl} githubUrl={githubUrl} />
          </div>
        }
      />

      <Card className="relative flex h-[300px] flex-col-reverse gap-0 !p-0 lg:flex-row">
        <div className="lg:max-w-1/2 h-full w-full">
          <VEPreviewImage className="h-full w-full" />
        </div>
        <div className="flex flex-col items-center justify-center gap-4 p-6 md:flex-1 lg:items-start">
          <div className="flex flex-col items-center lg:items-start">
            <div className="flex items-center gap-2 text-lg font-semibold">
              Fern Visual Editor
              <BetaBadge />
            </div>
            <p className="text-muted-foreground text-sm">
              Modify your documentation without touching code.
            </p>
            {githubUrl == null && (
              <p className="text-muted-foreground text-sm">
                Connect your repository above to get started.
              </p>
            )}
          </div>

          {githubUrl != null &&
            (githubAuthState.validationResult.ok ? (
              <>
                <GoToEditorButton
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
            ) : (
              <ValidationErrorHandler
                error={githubAuthState.validationResult.error}
                githubUrl={githubUrl}
                orgName={orgName}
                site={docsUrl}
              />
            ))}
        </div>
      </Card>
    </div>
  );
}

interface ValidationErrorHandlerProps {
  error: GithubRepoValidationError;
  githubUrl?: string;
  orgName: Auth0OrgName;
  site: string;
}
function ValidationErrorHandler({
  error,
  orgName,
  site,
  githubUrl,
}: ValidationErrorHandlerProps) {
  switch (error.type) {
    case "FERN_BOT_NOT_INSTALLED":
      return (
        <>
          <p className="text-muted-foreground text-sm">
            {githubUrl ? (
              <>
                To get started, install the Fern app on{" "}
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline transition-colors"
                >
                  {getRepoDisplayNameFromUrl(githubUrl)}
                </a>
              </>
            ) : (
              "To get started, connect a Github repo above and install the Fern app on your chosen repository."
            )}
            .
          </p>
          <InstallGithubAppButton
            orgName={orgName}
            site={site}
            githubUrl={githubUrl}
          />
        </>
      );

    case "MALFORMED_GITHUB_URL":
      return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

    case "REPO_NOT_FOUND":
      return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

    case "FERN_CONFIG_JSON_MISSING":
      return (
        <WarningNote>
          {getValidationErrorMessage(error)}
          {githubUrl && (
            <>
              {" "}
              Check your repository{" "}
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline transition-colors"
              >
                here
              </a>
              .
            </>
          )}
        </WarningNote>
      );

    case "FERN_CONFIG_JSON_MALFORMED":
      return (
        <WarningNote>
          {getValidationErrorMessage(error)}
          {githubUrl && (
            <>
              {" "}
              Check your repository{" "}
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline transition-colors"
              >
                here
              </a>
              .
            </>
          )}
        </WarningNote>
      );

    case "FERN_CONFIG_JSON_ORG_MISMATCH":
      return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

    case "SITE_NOT_FOUND":
      return (
        <WarningNote>
          {getValidationErrorMessage(error)}
          {githubUrl && (
            <>
              {" "}
              Check your repository{" "}
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline transition-colors"
              >
                here
              </a>
              .
            </>
          )}
        </WarningNote>
      );

    case "MULTIPLE_PROJECTS_WITH_SITE":
      return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

    case "NO_PROJECTS":
      return (
        <WarningNote>
          {getValidationErrorMessage(error)}
          {githubUrl && (
            <>
              {" "}
              Check your repository{" "}
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline transition-colors"
              >
                here
              </a>
              .
            </>
          )}
        </WarningNote>
      );

    case "UNEXPECTED_ERROR":
      return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

    default:
      return (
        <WarningNote>
          We were unable to validate access to this repo. Please try again or
          contact support if the issue persists.
        </WarningNote>
      );
  }
}
