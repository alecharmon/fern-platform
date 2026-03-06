import { redirect } from "next/navigation";

import { getCachedAskAiStatus } from "@/app/services/fai/cachedAskAiStatus";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";

export declare namespace AskAiEnabledServerSide {
    export interface Props {
        docsUrl: string;
        orgName?: string;
        redirectWhenDisabled?: boolean;
        children: React.JSX.Element;
    }
}

export async function AskAiEnabledServerSide({
    docsUrl: encodedDocsUrl,
    orgName,
    redirectWhenDisabled = false,
    children
}: AskAiEnabledServerSide.Props) {
    const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });
    let askAiStatus = null;
    try {
        askAiStatus = await getCachedAskAiStatus(docsUrl);
    } catch (error) {
        console.error("Failed to fetch Ask AI status:", error);
        return null;
    }

    if (askAiStatus.ask_ai_enabled) {
        return children;
    }

    if (redirectWhenDisabled && orgName) {
        redirect(`/${orgName}/members`);
    }

    return null;
}
