import { useEffect, useReducer } from "react";
import { getInitialState, type SetupState, setupStateReducer } from "./setupStateMachine";

interface UseEditorSetupStateParams {
    isOpen: boolean;
    isRepoConnected: boolean;
    isAppInstalled: boolean;
    isLoadingInitialData: boolean;
    hasValidationError: boolean;
}

interface UseEditorSetupStateReturn {
    state: SetupState;
    handleRepoConnected: (hasAppInstalled: boolean) => void;
    handleAppInstalled: () => void;
    handleValidationSuccess: () => void;
    handleValidationError: () => void;
    handleReset: () => void;
}

/**
 * Custom hook to manage the editor setup state machine.
 * Handles state transitions based on connection status, app installation, and validation results.
 */
export function useEditorSetupState({
    isOpen,
    isRepoConnected,
    isAppInstalled,
    isLoadingInitialData,
    hasValidationError
}: UseEditorSetupStateParams): UseEditorSetupStateReturn {
    // Calculate the correct initial state based on loaded data
    const correctInitialState = getInitialState({
        isRepoConnected,
        isAppInstalled,
        hasValidationError
    });

    // Initialize state machine - start with CONNECT_GITHUB while loading
    const [state, dispatch] = useReducer(
        setupStateReducer,
        isLoadingInitialData ? "CONNECT_GITHUB" : correctInitialState
    );

    // Fast-forward to the correct state when data finishes loading
    // IMPORTANT: We must respect the state machine transitions and not skip states
    useEffect(() => {
        if (!isLoadingInitialData && isOpen && state === "CONNECT_GITHUB" && correctInitialState !== "CONNECT_GITHUB") {
            if (correctInitialState === "INSTALL_APP") {
                dispatch({ type: "REPO_CONNECTED", hasAppInstalled: false });
            } else if (correctInitialState === "VALIDATE_REPO") {
                dispatch({ type: "REPO_CONNECTED", hasAppInstalled: true });
            } else if (correctInitialState === "VALIDATION_ERROR") {
                dispatch({ type: "VALIDATION_ERROR" });
            } else if (correctInitialState === "SUCCESS") {
                dispatch({ type: "VALIDATION_SUCCESS" });
            }
        }
    }, [isLoadingInitialData, isOpen, state, correctInitialState]);

    // Handle state transitions based on validation results
    // Only dispatch VALIDATION_ERROR automatically - VALIDATION_SUCCESS is handled
    // explicitly by the onSuccess callback in ConfigurationCheckContent
    useEffect(() => {
        if (!isRepoConnected || !isAppInstalled) {
            return;
        }

        // Only dispatch error state automatically
        // Success state is handled by explicit onSuccess callback
        if (hasValidationError) {
            dispatch({ type: "VALIDATION_ERROR" });
        }
    }, [isRepoConnected, isAppInstalled, hasValidationError]);

    // Action handlers
    const handleRepoConnected = (hasAppInstalled: boolean) => {
        dispatch({ type: "REPO_CONNECTED", hasAppInstalled });
    };

    const handleAppInstalled = () => {
        dispatch({ type: "APP_INSTALLED" });
    };

    const handleValidationSuccess = () => {
        dispatch({ type: "VALIDATION_SUCCESS" });
    };

    const handleValidationError = () => {
        dispatch({ type: "VALIDATION_ERROR" });
    };

    const handleReset = () => {
        dispatch({ type: "RESET" });
    };

    return {
        state,
        handleRepoConnected,
        handleAppInstalled,
        handleValidationSuccess,
        handleValidationError,
        handleReset
    };
}
