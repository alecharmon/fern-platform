import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { GithubRepoValidationError } from "@/app/services/dal/github/validators";
import { getValidationErrorMessage } from "@/utils/errors";
import type { DocsUrl } from "@/utils/types";
import { WarningNote } from "../WarningNote";

interface ValidationErrorHandlerProps {
    error: GithubRepoValidationError;
    githubUrl?: string;
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
}

export function VisualEditorValidationErrorHandler({
    error,
    orgName,
    docsUrl,
    githubUrl
}: ValidationErrorHandlerProps) {
    switch (error.type) {
        case "FERN_BOT_NOT_INSTALLED":
            return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

        case "MALFORMED_GITHUB_URL":
            return <WarningNote>{getValidationErrorMessage(error)}</WarningNote>;

        case "DOMAIN_NOT_REGISTERED":
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

        case "SITE_NOT_FOUND": {
            const branch = error.defaultBranch || "main";
            const docsYmlUrl =
                githubUrl && error.docsYmlPath
                    ? `${githubUrl.replace(/\/$/, "")}/blob/${branch}/${error.docsYmlPath}`
                    : githubUrl;
            return (
                <WarningNote className="w-full">
                    <div>
                        <p className={error.foundSites && error.foundSites.length > 0 ? "mb-2" : ""}>
                            {getValidationErrorMessage(error)}
                        </p>
                        {error.foundSites && error.foundSites.length > 0 && (
                            <ul className="list-disc pl-5 space-y-1">
                                {error.foundSites.map((site, index) => (
                                    <li key={index}>{site}</li>
                                ))}
                            </ul>
                        )}
                        {docsYmlUrl && (
                            <p className="mt-2">
                                Check your project's docs.yml config{" "}
                                <a
                                    href={docsYmlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-primary underline transition-colors"
                                >
                                    here
                                </a>
                                .
                            </p>
                        )}
                    </div>
                </WarningNote>
            );
        }

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
