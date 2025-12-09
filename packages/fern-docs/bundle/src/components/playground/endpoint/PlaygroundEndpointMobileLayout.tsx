import { FernTabs } from "@fern-docs/components/FernTabs";
import { t } from "@fern-docs/i18n";
import { type ReactElement, type ReactNode, useState } from "react";

interface PlaygroundEndpointMobileLayoutProps {
    form: ReactNode;
    requestCard: ReactNode;
    responseCard: ReactNode;
    endpointId?: string;
    lang: string;
    mobileTab?: string;
    onMobileTabChange?: (value: string) => void;
}

export function PlaygroundEndpointMobileLayout({
    form,
    requestCard,
    responseCard,
    lang,
    mobileTab,
    onMobileTabChange
}: PlaygroundEndpointMobileLayoutProps): ReactElement<any> {
    const [internalTab, setInternalTab] = useState<string>("0");
    const tabValue = mobileTab ?? internalTab;

    const handleTabChange = (value: string) => {
        setInternalTab(value);
        onMobileTabChange?.(value);
    };

    return (
        <FernTabs
            className="px-4"
            value={tabValue}
            onValueChange={handleTabChange}
            tabs={[
                {
                    title: t(lang).apiReference.request,
                    content: (
                        <div className="space-y-4 pb-6">
                            {form}
                            {requestCard}
                        </div>
                    )
                },
                { title: t(lang).apiReference.response, content: responseCard }
            ]}
        />
    );
}
