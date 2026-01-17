import type { GitRepoValidationError } from "@/app/services/dal/git/validateGitRepoAccess";
import { getValidationErrorMessage } from "@/utils/errors";

interface ValidationErrorHandlerProps {
    error: GitRepoValidationError;
    githubUrl?: string;
}

export function VisualEditorValidationErrorHandler({ error, githubUrl }: ValidationErrorHandlerProps) {
    const checkRepositoryMessage = githubUrl ? (
        <>
            <br />
            <br />
            Check your repository{" "}
            <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-3 transition-all hover:underline"
            >
                here
            </a>
            .
        </>
    ) : null;
    switch (error.type) {
        case "FERN_BOT_NOT_INSTALLED":
        case "GHE_APP_NOT_INSTALLED":
        case "MALFORMED_GIT_URL":
        case "DOMAIN_NOT_REGISTERED":
        case "REPO_NOT_FOUND":
        case "REPO_NOT_CONNECTED":
        case "MULTIPLE_PROJECTS_WITH_SITE":
        case "UNEXPECTED_ERROR":
        case "GITLAB_TOKEN_NOT_CONFIGURED":
        case "GITLAB_API_ERROR":
        case "EDGE_CONFIG_ERROR":
        case "FERN_CONFIG_JSON_MISSING":
        case "FERN_CONFIG_JSON_MALFORMED":
        case "FERN_CONFIG_JSON_ORG_MISMATCH":
        case "NO_PROJECTS":
            return (
                <>
                    {getValidationErrorMessage(error)}
                    {checkRepositoryMessage}
                </>
            );

        case "SITE_NOT_FOUND": {
            const branch = error.defaultBranch || "main";
            const docsYmlUrl =
                githubUrl && error.docsYmlPath
                    ? `${githubUrl.replace(/\/$/, "")}/blob/${branch}/${error.docsYmlPath}`
                    : githubUrl;
            return (
                <>
                    <div>
                        <p className={error.foundSites && error.foundSites.length > 0 ? "mb-2" : ""}>
                            {getValidationErrorMessage(error)}
                        </p>
                        {error.foundSites && error.foundSites.length > 0 && (
                            <ul className="list-disc space-y-1 pl-5">
                                {error.foundSites.map((site, index) => (
                                    <li key={index}>
                                        <code>{site}</code>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {docsYmlUrl && (
                            <p className="mt-2">
                                Add your URL{" "}
                                <a
                                    href={docsYmlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:text-primary/70 underline underline-offset-2 transition-colors"
                                >
                                    here
                                </a>
                                .
                            </p>
                        )}
                    </div>
                </>
            );
        }

        default: {
            // This ensures we handle all cases exhaustively
            // If a new error type is added, TypeScript will error here
            const _exhaustiveCheck: never = error;
            return _exhaustiveCheck;
        }
    }
}
