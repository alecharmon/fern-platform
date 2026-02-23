"use client";

import { useRouter } from "@bprogress/next/app";
import type { DocsSite } from "@fern-api/fdr-sdk/orpc-client";
import { useEffect, useState } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { constructDocsUrlParam } from "@/utils/constructDocsUrlParam";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import type { DocsUrl } from "@/utils/types";
import { useOrgNameFromPathname } from "@/utils/useOrgNameFromPathname";

export declare namespace DocsSiteSelect {
    export interface Props {
        currentDocsUrl: string | undefined;
        docsSites: DocsSite[];
    }
}

export const DocsSiteSelect = ({ currentDocsUrl, docsSites }: DocsSiteSelect.Props) => {
    const orgName = useOrgNameFromPathname();

    const [localValue, setLocalValue] = useState(currentDocsUrl);
    useEffect(() => {
        setLocalValue(currentDocsUrl);
    }, [currentDocsUrl]);

    const router = useRouter();

    const onClickUrl = async (newUrl: DocsUrl) => {
        if (newUrl === currentDocsUrl) {
            return;
        }
        setLocalValue(newUrl);
        router.push(`/${orgName}/docs/${constructDocsUrlParam(newUrl)}`);
    };

    return (
        <Select
            value={localValue}
            onValueChange={(value) => {
                void onClickUrl(value as DocsUrl);
            }}
            disabled={docsSites.length === 0}
        >
            <SelectTrigger>
                <span className="truncate">
                    <SelectValue placeholder="Organization" />
                </span>
            </SelectTrigger>
            <SelectContent>
                {docsSites.map((docsSite) => {
                    const url = getDocsSiteUrl(docsSite);
                    return (
                        <SelectItem key={url} value={url}>
                            {url}
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};
