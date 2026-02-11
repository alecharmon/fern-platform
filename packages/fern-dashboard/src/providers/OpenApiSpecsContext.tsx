"use client";

/**
 * OpenAPI Specs Context
 *
 * Combined provider for OpenAPI specs data and description editing.
 * Manages specs, pending changes, resolver, and editing state.
 */

import type { ApiSourceType } from "@fern-api/docs-loader";
import { type OpenApiPendingChange, useMaybeNavigation } from "@fern-docs/components/navigation";
import yaml from "js-yaml";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import {
    createResolver,
    type DescriptionTarget,
    getParameterDetails,
    type OpenApiResolver,
    type OpenApiResolverFailureReason,
    type OpenApiResolverResult
} from "@/utils/openapi-resolver";
import {
    createOverrideContent,
    createParameterOverrideContent,
    updateYamlValue,
    type YamlUpdateResult
} from "@/utils/openapi-resolver/yaml-utils";

// Re-export types for consumers
export type {
    DescriptionTarget,
    OpenApiResolverFailureReason,
    OpenApiResolverResult
} from "@/utils/openapi-resolver";

// Stable empty Map reference to avoid creating new objects on every render
const EMPTY_PENDING_CHANGES = new Map<string, OpenApiPendingChange>();

/**
 * Represents a pending change to an OpenAPI spec file.
 * Re-exported from NavigationStore for backwards compatibility.
 */
export type PendingSpecChange = OpenApiPendingChange;

/**
 * Edit state for a description being edited.
 */
export interface DescriptionEditState {
    target: DescriptionTarget;
    currentValue: string;
    filePath: string;
    jsonPath: string[];
}

interface OpenApiSpecsContextValue {
    /** Map of file path to file content */
    specs: Map<string, string> | null;
    /** The API source type detected from generators.yml */
    sourceType: ApiSourceType | null;
    /** Set of file paths that are override files (for edit priority) */
    overrideFilePaths: Set<string>;
    /** Path to generators.yml (for updating when creating new override files) */
    generatorsYmlPath: string | null;
    /** Content of generators.yml (for displaying in Dev Mode panel) */
    generatorsYmlContent: string | null;
    /** Whether to prefer writing to override files instead of main specs */
    preferOverrides: boolean;

    /** Map of file paths to pending changes (files that have been modified but not committed) */
    pendingChanges: Map<string, PendingSpecChange>;
    /** Whether there are any pending changes */
    hasPendingChanges: boolean;
    /** Clear all pending changes (after commit) */
    clearPendingChanges: () => void;
    /** Get files ready for commit (only modified files) */
    getFilesForCommit: () => Array<{ path: string; content: string }>;
    /** Reset a single file's changes (restore original content) */
    resetSpecChange: (filePath: string) => void;

    /* Update a description in the OpenAPI spec */
    updateDescription: (
        filePath: string,
        jsonPath: string[],
        newDescription: string
    ) => Promise<YamlUpdateResult | null>;
    /**
     * Add a new file to the specs (e.g., for creating new override files).
     * The file will be tracked as a pending change.
     * @param isOverride If true (default), the file is tracked as an override file
     */
    addNewFile: (filePath: string, content: string, isOverride?: boolean) => void;
    /* Update generators.yml to add an override file reference */
    updateGeneratorsYml: (overridePath: string, mainSpecPath: string) => void;
    /** Whether editing is available (OpenAPI specs loaded) */
    isEditingAvailable: boolean;
    /** Currently editing state, or null if not editing */
    editingState: DescriptionEditState | null;
    /** Start editing a description */
    startEditing: (target: DescriptionTarget, currentValue: string) => void;
    /** Cancel editing */
    cancelEditing: () => void;
    /** Save edited description */
    saveDescription: (newValue: string) => Promise<void>;
    /** Check if a target can be edited (resolves to a valid location) */
    resolveLocation: (target: DescriptionTarget) => OpenApiResolverResult;
    /** Get the resolver instance (for advanced usage) */
    resolver: OpenApiResolver | null;
}

const OpenApiSpecsContext = createContext<OpenApiSpecsContextValue>({
    // Specs data
    specs: null,
    sourceType: null,
    overrideFilePaths: new Set(),
    generatorsYmlPath: null,
    generatorsYmlContent: null,
    preferOverrides: true,
    // Pending changes
    pendingChanges: new Map(),
    hasPendingChanges: false,
    clearPendingChanges: () => {},
    getFilesForCommit: () => [],
    resetSpecChange: () => {},
    // Low-level update methods
    updateDescription: async () => null,
    addNewFile: () => {},
    updateGeneratorsYml: () => {},
    // Editing state
    isEditingAvailable: false,
    editingState: null,
    startEditing: () => {},
    cancelEditing: () => {},
    saveDescription: async () => {},
    resolveLocation: () => ({ location: null, reason: "not-found" }),
    resolver: null
});

export interface OpenApiSpecsProviderProps {
    children: ReactNode;
    specs: Map<string, string> | null;
    sourceType: ApiSourceType | null;
    /** Set of file paths that are override files (for edit priority) */
    overrideFilePaths?: Set<string>;
    /** Path to generators.yml (for updating when creating new override files) */
    generatorsYmlPath?: string;
    /** Content of generators.yml (for updating when creating new override files) */
    generatorsYmlContent?: string;
    /** Whether to prefer writing to override files instead of main specs. Defaults to true. */
    preferOverrides?: boolean;
}

export function OpenApiSpecsProvider({
    children,
    specs: initialSpecs,
    sourceType,
    overrideFilePaths: initialOverrideFilePaths,
    generatorsYmlPath: initialGeneratorsYmlPath,
    generatorsYmlContent: initialGeneratorsYmlContent,
    preferOverrides: initialPreferOverrides = true
}: OpenApiSpecsProviderProps) {
    // Get navigation context for persisting changes to IndexedDB
    const navigation = useMaybeNavigation();
    const isHydrated = navigation?.hydrated ?? false;

    // Track original specs (from server, updated after commit to persist new files)
    const [originalSpecs, setOriginalSpecs] = useState<Map<string, string> | null>(initialSpecs);

    // Override file tracking - keep initial values in state for local additions
    const [localOverrideFilePaths, setLocalOverrideFilePaths] = useState<Set<string>>(new Set());
    const [generatorsYmlPath] = useState<string | null>(initialGeneratorsYmlPath ?? null);
    const [generatorsYmlContent, setGeneratorsYmlContent] = useState<string | null>(
        initialGeneratorsYmlContent ?? null
    );
    // Track original generators.yml content for reset
    const [originalGeneratorsYmlContent] = useState<string | null>(initialGeneratorsYmlContent ?? null);
    const [preferOverrides] = useState<boolean>(initialPreferOverrides);

    // Editing state (merged from DescriptionEditProvider)
    const [editingState, setEditingState] = useState<DescriptionEditState | null>(null);

    // Get pending changes from NavigationStore (persisted to IndexedDB)
    // Only use navigation's pending changes once hydrated to avoid losing committed files
    // Before hydration, use stable empty Map reference to avoid unnecessary re-renders
    const pendingChanges = isHydrated
        ? (navigation?.openApiPendingChanges ?? EMPTY_PENDING_CHANGES)
        : EMPTY_PENDING_CHANGES;

    // Derive overrideFilePaths by merging:
    // 1. Initial override file paths (from server props)
    // 2. Local additions (new files added during current session before hydration)
    // 3. New files from pending changes (files NOT in originalSpecs are new override files)
    const overrideFilePaths = useMemo(() => {
        const merged = new Set(initialOverrideFilePaths ?? []);

        // Add local additions
        for (const path of localOverrideFilePaths) {
            merged.add(path);
        }

        // Add new files from pending changes
        // Files in pendingChanges but NOT in originalSpecs are new override files created during editing
        for (const [filePath] of pendingChanges) {
            if (!originalSpecs?.has(filePath)) {
                merged.add(filePath);
            }
        }

        return merged;
    }, [initialOverrideFilePaths, localOverrideFilePaths, pendingChanges, originalSpecs]);

    // Derive specs by merging original specs with pending changes
    // This eliminates hydration timing issues - specs is always computed from current state
    const specs = useMemo(() => {
        if (!originalSpecs) {
            return null;
        }

        // If no pending changes, return original specs directly
        if (pendingChanges.size === 0) {
            return originalSpecs;
        }

        // Merge pending changes into a copy of original specs
        const merged = new Map(originalSpecs);
        for (const [filePath, change] of pendingChanges) {
            merged.set(filePath, change.currentContent);
        }
        return merged;
    }, [originalSpecs, pendingChanges]);

    // Create resolver from specs (merged from DescriptionEditProvider)
    const resolver = useMemo(() => {
        if (!specs || sourceType !== "openapi") {
            return null;
        }
        try {
            return createResolver(specs, overrideFilePaths);
        } catch (error) {
            console.error("Failed to create resolver:", error);
            return null;
        }
    }, [specs, sourceType, overrideFilePaths]);

    // isEditingAvailable means "we have specs to display" (not "we can edit specs")
    // This allows edit-disabled indicators to show for non-OpenAPI formats
    const isEditingAvailable = specs !== null && specs.size > 0;

    const updateDescription = useCallback(
        async (filePath: string, jsonPath: string[], newDescription: string): Promise<YamlUpdateResult | null> => {
            if (!specs || !originalSpecs) {
                return null;
            }

            const currentContent = specs.get(filePath);
            if (!currentContent) {
                return null;
            }

            // Update the YAML/JSON content
            const result = updateYamlValue(currentContent, jsonPath, newDescription);

            if (result.success && result.content) {
                const updatedContent = result.content;

                // Track pending change in NavigationStore (persisted to IndexedDB)
                // The derived `specs` will automatically include this change
                const originalContent = originalSpecs.get(filePath) ?? currentContent;
                navigation?.updateOpenApiChange(filePath, originalContent, updatedContent);
            }

            return result;
        },
        [specs, originalSpecs, navigation]
    );

    const addNewFile = useCallback(
        (filePath: string, content: string, isOverride = true) => {
            // Track as pending change in NavigationStore (new file has empty original content)
            // The derived `specs` will automatically include this new file
            navigation?.updateOpenApiChange(filePath, "", content);

            // Track new override files locally so the resolver sees them immediately
            // Note: These will also be derived from pendingChanges (via empty originalContent),
            // but we add them locally for immediate reactivity before the next render cycle
            if (isOverride) {
                setLocalOverrideFilePaths((prev) => {
                    if (prev.has(filePath)) {
                        return prev;
                    }
                    const newOverrideFilePaths = new Set(prev);
                    newOverrideFilePaths.add(filePath);
                    return newOverrideFilePaths;
                });
            }
        },
        [navigation]
    );

    const updateGeneratorsYml = useCallback(
        (overridePath: string, mainSpecPath: string) => {
            if (!generatorsYmlPath || !generatorsYmlContent) {
                console.warn("[OpenApiSpecsContext] Cannot update generators.yml: path or content not available");
                return;
            }

            try {
                // Parse generators.yml to find the correct spec entry
                const parsed = yaml.load(generatorsYmlContent) as Record<string, unknown>;
                const api = parsed?.api as Record<string, unknown> | undefined;
                const specsArray = api?.specs as Array<Record<string, unknown>> | undefined;

                if (!specsArray || !Array.isArray(specsArray)) {
                    console.warn("[OpenApiSpecsContext] Cannot update generators.yml: api.specs not found");
                    return;
                }

                // Normalize path for comparison (remove leading ./ or /)
                const normalizePath = (p: string) => p.replace(/^\.\//, "").replace(/^\//, "");

                // Find the spec entry that matches our main spec
                const specIndex = specsArray.findIndex((spec) => {
                    const openapi = normalizePath(spec.openapi?.toString() ?? "");
                    const mainNorm = normalizePath(mainSpecPath);
                    // Match by exact normalized path or by filename
                    return (
                        openapi === mainNorm ||
                        openapi.endsWith("/" + (mainNorm.split("/").pop() ?? "")) ||
                        mainNorm.endsWith("/" + (openapi.split("/").pop() ?? ""))
                    );
                });

                if (specIndex === -1) {
                    console.warn("[OpenApiSpecsContext] Cannot update generators.yml: matching spec not found", {
                        mainSpecPath,
                        availableSpecs: specsArray.map((s) => s.openapi)
                    });
                    return;
                }

                // Convert overridePath to be relative to generators.yml
                // E.g., if generatorsYmlPath is "docs/fern/generators.yml" and overridePath is "docs/fern/openapi-overrides.yaml"
                // the result should be "./openapi-overrides.yaml"
                const generatorsDir = generatorsYmlPath.substring(0, generatorsYmlPath.lastIndexOf("/"));
                let relativeOverridePath = overridePath;

                if (generatorsDir && overridePath.startsWith(generatorsDir + "/")) {
                    // Override is in same directory as generators.yml - make it relative
                    relativeOverridePath = "./" + overridePath.substring(generatorsDir.length + 1);
                } else if (
                    !overridePath.startsWith("./") &&
                    !overridePath.startsWith("/") &&
                    !overridePath.includes("/")
                ) {
                    // Simple filename without path - add ./
                    relativeOverridePath = "./" + overridePath;
                }
                // Otherwise keep the path as-is (e.g., for paths in parent directories)

                // Add overrides field to that spec entry
                const result = updateYamlValue(
                    generatorsYmlContent,
                    ["api", "specs", String(specIndex), "overrides"],
                    relativeOverridePath
                );

                if (result.success && result.content) {
                    // Update local generators.yml content state
                    setGeneratorsYmlContent(result.content);

                    // Track as pending change in NavigationStore
                    const originalContent = generatorsYmlContent;
                    navigation?.updateOpenApiChange(generatorsYmlPath, originalContent, result.content);
                }
            } catch (error) {
                console.error("[OpenApiSpecsContext] Failed to update generators.yml:", error);
            }
        },
        [generatorsYmlPath, generatorsYmlContent, navigation]
    );

    const hasPendingChanges = useMemo(
        () => Array.from(pendingChanges.values()).some((c) => c.currentContent !== c.originalContent),
        [pendingChanges]
    );

    const clearPendingChanges = useCallback(() => {
        // Update local state to reflect committed content
        if (pendingChanges.size > 0) {
            setOriginalSpecs((prev) => {
                if (!prev) {
                    return prev;
                }
                const merged = new Map(prev);
                for (const [filePath, change] of pendingChanges) {
                    merged.set(filePath, change.currentContent);
                }
                return merged;
            });

            // Also update generators.yml content if it was modified
            const genChange = pendingChanges.get(generatorsYmlPath ?? "");
            if (genChange) {
                setGeneratorsYmlContent(genChange.currentContent);
            }
        }

        // Mark changes as committed in IndexedDB (sets originalContent = currentContent)
        // This preserves files so they survive page refresh while showing no uncommitted changes
        navigation?.commitOpenApiChanges();
    }, [navigation, pendingChanges, generatorsYmlPath]);

    const getFilesForCommit = useCallback(
        (): Array<{ path: string; content: string }> =>
            Array.from(pendingChanges.values())
                .filter((c) => c.currentContent !== c.originalContent)
                .map((c) => ({ path: c.filePath, content: c.currentContent })),
        [pendingChanges]
    );

    const resetSpecChange = useCallback(
        (filePath: string) => {
            // Remove from pending changes in NavigationStore
            // The derived `specs` will automatically reflect the reset
            navigation?.resetOpenApiChange(filePath);

            // If this was a new override file, clean up related state
            if (!originalSpecs?.has(filePath)) {
                // Remove from local override file paths
                setLocalOverrideFilePaths((prev) => {
                    if (!prev.has(filePath)) {
                        return prev;
                    }
                    const newOverrideFilePaths = new Set(prev);
                    newOverrideFilePaths.delete(filePath);
                    return newOverrideFilePaths;
                });

                // Also reset generators.yml if it was modified to reference this new override file
                if (generatorsYmlPath) {
                    navigation?.resetOpenApiChange(generatorsYmlPath);

                    // Restore original generators.yml content
                    setGeneratorsYmlContent(originalGeneratorsYmlContent);
                }
            }
        },
        [originalSpecs, generatorsYmlPath, originalGeneratorsYmlContent, navigation]
    );

    const resolveLocation = useCallback(
        (target: DescriptionTarget): OpenApiResolverResult => {
            // WebSocket and Webhook targets are not yet editable
            if (target.type === "websocket" || target.type === "webhook") {
                return { location: null, reason: "unsupported-protocol" };
            }
            // gRPC targets use proto format, not OpenAPI
            if (target.type === "grpc") {
                return { location: null, reason: "non-openapi-format" };
            }
            // Security scheme (auth) targets are not yet editable
            if (target.type === "securityScheme") {
                return { location: null, reason: "security-scheme-not-supported" };
            }
            return resolver
                ? resolver.resolve(target)
                : {
                      location: null,
                      reason: sourceType && sourceType !== "openapi" ? "non-openapi-format" : "not-found"
                  };
        },
        [resolver, sourceType]
    );

    const startEditing = useCallback(
        (target: DescriptionTarget, currentValue: string) => {
            if (!resolver) {
                return;
            }
            const writeResult = resolver.resolveWriteLocation(target, preferOverrides);
            if (!writeResult.location) {
                console.warn("Cannot edit: location not found", { target, reason: writeResult.reason });
                return;
            }
            // Use inlineJsonPath if available (for $ref'd schemas in request/response bodies)
            // This ensures the override file uses the correct inline path
            const jsonPathForEditing = writeResult.location.inlineJsonPath ?? writeResult.location.jsonPath;

            setEditingState({
                target,
                currentValue,
                filePath: writeResult.location.filePath,
                jsonPath: jsonPathForEditing
            });
        },
        [resolver, preferOverrides]
    );

    const cancelEditing = useCallback(() => setEditingState(null), []);

    const saveDescription = useCallback(
        async (newValue: string) => {
            if (!editingState || !resolver) {
                return;
            }

            try {
                // Resolve the write location to check if we need override handling
                const writeResult = resolver.resolveWriteLocation(editingState.target, preferOverrides);

                if (writeResult.needsOverrideFile && writeResult.suggestedOverridePath) {
                    // Need to create a new override file
                    let overrideContent: string;

                    // Determine output format based on the suggested override path
                    const overrideFormat = writeResult.suggestedOverridePath.endsWith(".json") ? "json" : "yaml";

                    // For parameters, we need to include name and in fields for proper merging
                    if (editingState.target.type === "parameter") {
                        const paramDetails = getParameterDetails(resolver, editingState.target);
                        if (paramDetails) {
                            overrideContent = createParameterOverrideContent(
                                editingState.jsonPath,
                                newValue,
                                paramDetails,
                                overrideFormat
                            );
                        } else {
                            // Fallback if we can't get parameter details
                            console.warn("[OpenApiSpecsContext] Could not get parameter details for override");
                            overrideContent = createOverrideContent(editingState.jsonPath, newValue, overrideFormat);
                        }
                    } else {
                        overrideContent = createOverrideContent(editingState.jsonPath, newValue, overrideFormat);
                    }

                    // Create new override file with the content
                    addNewFile(writeResult.suggestedOverridePath, overrideContent);

                    // Update generators.yml to reference the new override file
                    const mainSpecPath = writeResult.location?.filePath;
                    if (mainSpecPath) {
                        updateGeneratorsYml(writeResult.suggestedOverridePath, mainSpecPath);
                    }
                } else {
                    // Normal case: write to existing file (main spec or existing override)
                    const targetFilePath = writeResult.location?.filePath ?? editingState.filePath;
                    const targetJsonPath = writeResult.location?.jsonPath ?? editingState.jsonPath;

                    const result = await updateDescription(targetFilePath, targetJsonPath, newValue);
                    if (!result?.success) {
                        throw new Error(result?.error ?? "Failed to update description");
                    }
                }

                setEditingState(null);
            } catch (error) {
                console.error("[OpenApiSpecsContext] Failed to save description:", error);
                throw error;
            }
        },
        [editingState, resolver, preferOverrides, updateDescription, addNewFile, updateGeneratorsYml]
    );

    const value = useMemo(
        () => ({
            // Specs data
            specs,
            sourceType,
            overrideFilePaths,
            generatorsYmlPath,
            generatorsYmlContent,
            preferOverrides,
            // Pending changes
            pendingChanges,
            hasPendingChanges,
            clearPendingChanges,
            getFilesForCommit,
            resetSpecChange,
            // Low-level update methods
            updateDescription,
            addNewFile,
            updateGeneratorsYml,
            // Editing state
            isEditingAvailable,
            editingState,
            startEditing,
            cancelEditing,
            saveDescription,
            resolveLocation,
            resolver
        }),
        [
            specs,
            sourceType,
            overrideFilePaths,
            generatorsYmlPath,
            generatorsYmlContent,
            preferOverrides,
            pendingChanges,
            hasPendingChanges,
            clearPendingChanges,
            getFilesForCommit,
            resetSpecChange,
            updateDescription,
            addNewFile,
            updateGeneratorsYml,
            isEditingAvailable,
            editingState,
            startEditing,
            cancelEditing,
            saveDescription,
            resolveLocation,
            resolver
        ]
    );

    return <OpenApiSpecsContext.Provider value={value}>{children}</OpenApiSpecsContext.Provider>;
}

/**
 * Hook to access OpenAPI specs data and editing functionality.
 */
export function useOpenApiSpecs() {
    return useContext(OpenApiSpecsContext);
}

/**
 * Hook to access description editing functionality.
 * Alias for useOpenApiSpecs() for backwards compatibility.
 */
export function useDescriptionEdit() {
    return useContext(OpenApiSpecsContext);
}

/** Hook to check if a specific description target is editable. */
export function useDescriptionEditability(target: DescriptionTarget | null): {
    isEditable: boolean;
    reason?: OpenApiResolverFailureReason;
} {
    const { resolveLocation } = useOpenApiSpecs();
    return useMemo(() => {
        if (!target) {
            return { isEditable: false, reason: "editing-not-available" as const };
        }
        // resolveLocation handles non-OpenAPI formats by returning
        // { location: null, reason: "non-openapi-format" } when resolver is null
        const result = resolveLocation(target);
        return { isEditable: result.location !== null, reason: result.reason };
    }, [target, resolveLocation]);
}

/** Hook to get the live description value from specs context (enables live UI updates after editing). */
export function useLiveDescription(
    target: DescriptionTarget | null,
    fallbackValue: string | undefined
): string | undefined {
    const { resolver, specs, preferOverrides } = useOpenApiSpecs();
    return useMemo(() => {
        if (!target || !resolver || !specs) {
            return fallbackValue;
        }
        return resolver.getDescriptionValue(target, specs, preferOverrides) ?? fallbackValue;
    }, [target, resolver, specs, preferOverrides, fallbackValue]);
}
