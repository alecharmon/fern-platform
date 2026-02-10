"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { DashboardApiClient } from "@/app/services/dashboard-api/client";
import type { DocsUrl } from "@/utils/types";
import type { ExportTask } from "./types";

type PdfExportTasksState =
    | {
          status: "idle" | "loading";
          tasks: ExportTask[];
      }
    | {
          status: "success";
          tasks: ExportTask[];
      }
    | {
          status: "error";
          tasks: ExportTask[];
          errorMessage: string;
      };

type PdfExportTasksContextValue = PdfExportTasksState & {
    refresh: () => Promise<void>;
    upsertTask: (task: ExportTask) => void;
};

const PdfExportTasksContext = createContext<PdfExportTasksContextValue | null>(null);

const FETCH_LIMIT = 25;
const POLL_INTERVAL_MS = 5_000;

export function PdfExportTasksProvider({
    orgName,
    docsUrl,
    children
}: {
    orgName: Auth0OrgName;
    docsUrl: DocsUrl;
    children: React.ReactNode;
}) {
    const [state, setState] = useState<PdfExportTasksState>({ status: "idle", tasks: [] });
    const refreshInFlightRef = useRef(false);

    const refresh = useCallback(async () => {
        if (refreshInFlightRef.current) {
            return;
        }
        refreshInFlightRef.current = true;
        try {
            setState((prev) => {
                if (prev.status === "success") {
                    // Keep showing current data while we background-refresh.
                    return prev;
                }
                return { status: "loading", tasks: prev.tasks };
            });
            const resp = await DashboardApiClient.listPdfExportTasks({
                orgName,
                docsUrl,
                limit: FETCH_LIMIT
            });
            setState({ status: "success", tasks: resp.tasks });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to load exports";
            setState((prev) => {
                // If we already have a successful list, keep it (polling failures shouldn't wipe the UI).
                if (prev.status === "success") {
                    return prev;
                }
                return { status: "error", tasks: prev.tasks, errorMessage: message };
            });
        } finally {
            refreshInFlightRef.current = false;
        }
    }, [docsUrl, orgName]);

    const upsertTask = useCallback((task: ExportTask) => {
        setState((prev) => {
            const id = String(task.id);
            const existingIndex = prev.tasks.findIndex((t) => String(t.id) === id);
            if (existingIndex === -1) {
                return { ...prev, tasks: [task, ...prev.tasks] };
            }
            const next = prev.tasks.slice();
            next[existingIndex] = task;
            return { ...prev, tasks: next };
        });
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useEffect(() => {
        const hasActive = state.tasks.some((t) => t.status === "PENDING" || t.status === "RUNNING");
        if (!hasActive) {
            return;
        }
        const interval = window.setInterval(() => {
            void refresh();
        }, POLL_INTERVAL_MS);
        return () => window.clearInterval(interval);
    }, [refresh, state.tasks]);

    const value = useMemo<PdfExportTasksContextValue>(
        () => ({ ...state, refresh, upsertTask }),
        [refresh, state, upsertTask]
    );

    return <PdfExportTasksContext.Provider value={value}>{children}</PdfExportTasksContext.Provider>;
}

export function usePdfExportTasks(): PdfExportTasksContextValue {
    const ctx = useContext(PdfExportTasksContext);
    if (ctx == null) {
        throw new Error("usePdfExportTasks must be used within PdfExportTasksProvider");
    }
    return ctx;
}
