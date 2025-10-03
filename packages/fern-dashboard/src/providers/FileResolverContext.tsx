"use client";

import { createContext, useContext } from "react";

import { DashboardFileResolver } from "@fern-api/docs-server/dashboard-file-resolver";
import { FileData } from "@fern-api/docs-utils/types/file-data";

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
    const fileResolver = new DashboardFileResolver(files);

    const resolveFileSrc = (src: string | undefined) => fileResolver.getResolvedFileData(src);

    return <FileResolverContext.Provider value={{ resolveFileSrc }}>{children}</FileResolverContext.Provider>;
};

export const useFileResolver = () => {
    return useContext(FileResolverContext);
};
