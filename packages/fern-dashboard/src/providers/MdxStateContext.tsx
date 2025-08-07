"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChangedNodes, MdxToHtmlResponse, htmlToMdx } from "@fern-docs/mdx";

import { setMdxFile } from "@/app/actions/setMdxFile";
import { DocsUrl } from "@/utils/types";

type Filename = string;
type Markdown = string;
type SyncedStatus = "STAGED" | "SYNCING" | "SYNCED" | "ERROR";

// Amount of time to wait before syncing mdx changes to the server
export const DEBOUNCE_TIMEOUT_DELAY = 300;

interface MdxDependencies {
  html?: MdxToHtmlResponse["html"];
  frontmatter?: MdxToHtmlResponse["frontmatter"];
  originalElements?: MdxToHtmlResponse["originalElements"];
  originalFrontmatter?: MdxToHtmlResponse["originalFrontmatter"];
  /**
   * Flag if the file should be considered changed.
   * This is used to determine if content changes should be committed to repo.
   */
  changed?: boolean;
  /**
   * Map of specific node that have changed.
   * This is used to determine if we should use the original MDX content formatting from originalElements.
   */
  changedNodes?: ChangedNodes;
  /**
   * Flag if the frontmatter has changed.
   * This is used to determine if we should use the original frontmatter formatting from originalFrontmatter.
   */
  changedFrontmatter?: boolean;
}

export const MdxStateContext = createContext<{
  changedMdxFiles: Record<Filename, Markdown>;
  allMdxFiles: Record<Filename, Markdown>;
  frontmatterData: Record<Filename, MdxToHtmlResponse["frontmatter"]>;
  mdxSyncedStatus: Record<Filename, SyncedStatus>;
  updateDependencies: (filename: Filename, state: MdxDependencies) => void;
  stageChanges: (filename: Filename, state: MdxDependencies) => void;
  syncChanges: (filename: Filename) => Promise<void>;
}>({
  changedMdxFiles: {},
  allMdxFiles: {},
  frontmatterData: {},
  mdxSyncedStatus: {},
  updateDependencies: () => undefined,
  stageChanges: () => undefined,
  syncChanges: () => Promise.resolve(),
});

export function MdxStateProvider({
  children,
  docsUrl,
}: {
  children: ReactNode;
  docsUrl: DocsUrl;
}) {
  const [mdxDepsStore, setMdxDepsStore] = useState<
    Record<Filename, MdxDependencies>
  >({});

  const [mdxSyncedStatus, setMdxSyncedStatus] = useState<
    Record<Filename, SyncedStatus>
  >({});

  const initialFrontmatter = useRef<
    Record<string, MdxToHtmlResponse["frontmatter"]>
  >({});

  // Track debounce timeouts for each file to prevent excessive syncs
  const debounceTimeouts = useRef<Record<string, NodeJS.Timeout | null>>({});

  // Stablilize updateDependencies identity to prevent unnecessary re-renders
  const updateDependencies = useCallback(
    (filename: Filename, state: MdxDependencies) => {
      setMdxDepsStore((prev) => {
        if (state.frontmatter && !initialFrontmatter.current[filename]) {
          // Store reference to initial frontmatter for changedFrontmatter comparison
          initialFrontmatter.current[filename] = state.frontmatter;
        }
        return {
          ...prev,
          [filename]: {
            html: state.html ?? prev[filename]?.html,
            frontmatter: (() => {
              const existingFrontmatter = prev[filename]?.frontmatter || {};
              const newFrontmatter = state.frontmatter || {};
              const mergedFrontmatter = {
                ...existingFrontmatter,
              };

              // Apply new frontmatter changes, removing fields with undefined values
              Object.entries(newFrontmatter).forEach(([key, value]) => {
                if (value == null) {
                  mergedFrontmatter[key] = key === "title" ? "" : undefined; // Always keep title field
                } else {
                  mergedFrontmatter[key] = value;
                }
              });

              return mergedFrontmatter;
            })(),
            originalElements:
              state.originalElements ?? prev[filename]?.originalElements,
            originalFrontmatter:
              state.originalFrontmatter ?? prev[filename]?.originalFrontmatter,
            changed: state.changed ?? prev[filename]?.changed,
            changedNodes: {
              ...prev[filename]?.changedNodes,
              ...state.changedNodes,
            },
            // If we're setting frontmatter, check if it's different from the initial frontmatter, otherwise use the previous value
            changedFrontmatter: state.frontmatter
              ? JSON.stringify(state.frontmatter) !==
                JSON.stringify(initialFrontmatter.current[filename])
              : (prev[filename]?.changedFrontmatter ?? false),
          },
        };
      });
    },
    [setMdxDepsStore]
  );

  // Alias for updateDependencies that sets the changed flag to true by default
  const stageChanges = useCallback(
    (filename: Filename, state: MdxDependencies) => {
      updateDependencies(filename, { ...state, changed: true });
      // Immediately mark file as staged when changes are made
      setMdxSyncedStatus((prev) => ({
        ...prev,
        [filename]: "STAGED",
      }));
    },
    [updateDependencies]
  );

  // Build a map of changed files (changed flag is true) and their contents
  const changedMdxFiles = useMemo(() => {
    return Object.entries(mdxDepsStore).reduce<Record<Filename, Markdown>>(
      (acc, [filename, state]) => {
        if (
          state.changed &&
          state.html &&
          state.frontmatter &&
          state.originalElements
        ) {
          acc[filename] = htmlToMdx(
            state.html,
            state.frontmatter,
            state.originalElements,
            state.originalFrontmatter,
            state.changedNodes,
            // state.changedFrontmatter
            true //  TODO: re-enable (force true for now, there's a bug in the loader/FDR that provides malformed frontmatter)
          ).mdx;
        }
        return acc;
      },
      {}
    );
  }, [mdxDepsStore]);

  // Build a map of all files (both initial and changed) and their markdown contents
  const allMdxFiles = useMemo(() => {
    return Object.entries(mdxDepsStore).reduce<Record<Filename, Markdown>>(
      (acc, [filename, state]) => {
        if (state.html && state.frontmatter && state.originalElements) {
          acc[filename] = htmlToMdx(
            state.html,
            state.frontmatter,
            state.originalElements,
            state.originalFrontmatter,
            state.changedNodes,
            // state.changedFrontmatter
            true // TODO: re-enable (force true for now, there's a bug in the loader/FDR that provides malformed frontmatter)
          ).mdx;
        }
        return acc;
      },
      {}
    );
  }, [mdxDepsStore]);

  // Build a map of frontmatter data for all files
  const frontmatterData = useMemo(() => {
    return Object.entries(mdxDepsStore).reduce<
      Record<Filename, MdxToHtmlResponse["frontmatter"]>
    >((acc, [filename, state]) => {
      if (state.frontmatter) {
        acc[filename] = state.frontmatter;
      }
      return acc;
    }, {});
  }, [mdxDepsStore]);

  // Sync changes to the server via debounced setMdxFile server action
  const syncChanges = useCallback(
    async (filename: Filename) => {
      // Get content of file to sync
      const content = changedMdxFiles[filename];
      // Verify there is content to sync
      if (typeof content !== "undefined") {
        // Clear any existing timeout for this file
        const timeout = debounceTimeouts.current[filename];
        if (timeout) {
          clearTimeout(timeout);
        }
        // Set timeout to sync changes to the server
        debounceTimeouts.current[filename] = setTimeout(() => {
          setMdxSyncedStatus((prev) => ({
            ...prev,
            [filename]: "SYNCING",
          }));
          setMdxFile(docsUrl, filename, content)
            .then(() => {
              // If successful, mark file as synced
              setMdxSyncedStatus((prev) => ({
                ...prev,
                [filename]: "SYNCED",
              }));
            })
            .catch(() => {
              // If error, mark file as error
              setMdxSyncedStatus((prev) => ({
                ...prev,
                [filename]: "ERROR",
              }));
            });
          // Always clear the timeout on run
          debounceTimeouts.current[filename] = null;
        }, DEBOUNCE_TIMEOUT_DELAY);
      }
    },
    [docsUrl, changedMdxFiles]
  );

  return (
    <MdxStateContext.Provider
      value={{
        changedMdxFiles,
        allMdxFiles,
        frontmatterData,
        mdxSyncedStatus,
        updateDependencies,
        stageChanges,
        syncChanges,
      }}
    >
      {children}
    </MdxStateContext.Provider>
  );
}

export function useMdxState() {
  return useContext(MdxStateContext);
}
