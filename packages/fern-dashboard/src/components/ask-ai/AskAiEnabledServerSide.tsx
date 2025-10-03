import { redirect } from "next/navigation";

import { isAskAiEnabled } from "@/app/actions/toggleAskAi";
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
        askAiStatus = await isAskAiEnabled({ domain: docsUrl });
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
