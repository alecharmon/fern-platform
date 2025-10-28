import { FernTabs } from "@fern-docs/components/FernTabs";
import { type ReactElement, type ReactNode, useState } from "react";

import { I18N } from "@/constants";

interface PlaygroundEndpointMobileLayoutProps {
    form: ReactNode;
    requestCard: ReactNode;
    responseCard: ReactNode;
    sendButton: ReactNode;
    endpointId?: string;
}

export function PlaygroundEndpointMobileLayout({
    // endpointId,
    form,
    requestCard,
    responseCard,
    sendButton
}: PlaygroundEndpointMobileLayoutProps): ReactElement<any> {
    const [tabValue, setTabValue] = useState<string>("0");
    return (
        <FernTabs
            className="px-4"
            value={tabValue}
            onValueChange={setTabValue}
            tabs={[
                {
                    title: I18N.apiReference.request,
                    content: (
                        <div className="space-y-4 pb-6">
                            {form}
                            <div className="border-border-default flex justify-end border-b pb-4">
                                {sendButton}
                                {/* <PlaygroundSendRequestButton
                                    sendRequest={() => {
                                        sendRequest();
                                        setTabValue("1");
                                    }}
                                    sendRequestIcon={
                                        <SendSolid className="transition-transform group-hover:translate-x-0.5" />
                                    }
                                /> */}
                            </div>
                            {requestCard}
                        </div>
                    )
                },
                { title: I18N.apiReference.response, content: responseCard }
            ]}
        />
    );
}
