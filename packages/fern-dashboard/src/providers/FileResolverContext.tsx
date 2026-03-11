"use client";

import { DashboardFileResolver } from "@fern-api/docs-server/dashboard-file-resolver";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { createContext, useContext } from "react";
import { useCurrentPage } from "./CurrentPageContext";

export const FileResolverContext = createContext<{
    resolveFileSrc: DashboardFileResolver["getResolvedFileData"];
}>({
    resolveFileSrc: () => undefined
});

export const FileResolverProvider = ({
    children,
    files
}: {
    children: React.ReactNode;
    files: Record<string, FileData>;
}) => {
    const { currentFilename } = useCurrentPage();
    const fileResolver = new DashboardFileResolver(files);

    const resolveFileSrc = (src: string | undefined, currentFilePath?: string) =>
        fileResolver.getResolvedFileData(src, currentFilePath ?? currentFilename ?? undefined);

    return <FileResolverContext.Provider value={{ resolveFileSrc }}>{children}</FileResolverContext.Provider>;
};

export const useFileResolver = () => {
    return useContext(FileResolverContext);
};
