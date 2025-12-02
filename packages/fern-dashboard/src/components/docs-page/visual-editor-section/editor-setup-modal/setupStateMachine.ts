/**
 * State machine for the Finish Editor Setup Modal
 *
 * Flow:
 * 1. CONNECT_GITHUB - User needs to connect their GitHub repo
 *    - If successful and app is installed -> VALIDATE_REPO
 *    - If successful but app is not installed -> INSTALL_APP
 *
 * 2. INSTALL_APP - User needs to install the Fern GitHub app
 *    - If successful -> VALIDATE_REPO
 *
 * 3. VALIDATE_REPO - Automatically validate the repo configuration
 *    - If valid -> SUCCESS
 *    - If invalid -> VALIDATION_ERROR
 *
 * 4. VALIDATION_ERROR - Show validation errors and remediation steps
 *    - User can retry, which goes back to VALIDATE_REPO
 *
 * 5. SUCCESS - All setup complete, show confetti and auto-close
 */

export type SetupState = "CONNECT_GITHUB" | "INSTALL_APP" | "VALIDATE_REPO" | "VALIDATION_ERROR" | "SUCCESS";

export type SetupEvent =
    | { type: "REPO_CONNECTED"; hasAppInstalled: boolean }
    | { type: "APP_INSTALLED" }
    | { type: "VALIDATION_SUCCESS" }
    | { type: "VALIDATION_ERROR" }
    | { type: "RETRY_VALIDATION" }
    | { type: "RESET" };

export function getInitialState(props: {
    isRepoConnected: boolean;
    isAppInstalled: boolean;
    hasValidationError: boolean;
}): SetupState {
    const { isRepoConnected, isAppInstalled, hasValidationError } = props;

    // If everything is already complete
    if (isRepoConnected && isAppInstalled && !hasValidationError) {
        return "SUCCESS";
    }

    // If repo is connected and app is installed, but there's an error
    if (isRepoConnected && isAppInstalled && hasValidationError) {
        return "VALIDATION_ERROR";
    }

    // If repo is connected and app is installed, start validation
    if (isRepoConnected && isAppInstalled) {
        return "VALIDATE_REPO";
    }

    // If repo is connected but app is not installed
    if (isRepoConnected && !isAppInstalled) {
        return "INSTALL_APP";
    }

    // Default: need to connect repo
    return "CONNECT_GITHUB";
}

export function setupStateReducer(state: SetupState, event: SetupEvent): SetupState {
    // Global transitions
    if (event.type === "RESET") {
        return "CONNECT_GITHUB";
    }
    if (event.type === "VALIDATION_SUCCESS") {
        return "SUCCESS";
    }
    if (event.type === "VALIDATION_ERROR") {
        return "VALIDATION_ERROR";
    }

    switch (state) {
        case "CONNECT_GITHUB":
            if (event.type === "REPO_CONNECTED") {
                return event.hasAppInstalled ? "VALIDATE_REPO" : "INSTALL_APP";
            }
            return state;

        case "INSTALL_APP":
            if (event.type === "APP_INSTALLED") {
                return "VALIDATE_REPO";
            }
            return state;

        case "VALIDATE_REPO":
            return state;

        case "VALIDATION_ERROR":
            if (event.type === "RETRY_VALIDATION") {
                return "VALIDATE_REPO";
            }
            return state;

        case "SUCCESS":
            return state;

        default:
            return state;
    }
}
