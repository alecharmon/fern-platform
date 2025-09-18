import { Auth0OrgName } from "@/app/services/auth0/types";
import { GithubRepoValidationError } from "@/app/services/dal/github/validators";
import { getRepoDisplayNameFromUrl } from "@/app/services/github/github";
import { getValidationErrorMessage } from "@/utils/errors";

import { InstallGithubAppButton } from "../InstallGithubAppButton";
import { WarningNote } from "../WarningNote";

interface ValidationErrorHandlerProps {
  error: GithubRepoValidationError;
  githubUrl?: string;
  orgName: Auth0OrgName;
  site: string;
}

export function VisualEditorValidationErrorHandler({
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

    case "REPO_NOT_CONNECTED":
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

    default: {
      // This ensures we handle all cases exhaustively
      // If a new error type is added, TypeScript will error here
      const _exhaustiveCheck: never = error;
      return _exhaustiveCheck;
    }
  }
}
