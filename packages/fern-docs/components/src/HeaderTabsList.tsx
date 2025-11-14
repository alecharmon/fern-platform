import { slugToHref } from "@fern-api/docs-utils";
import type { FileData } from "@fern-api/docs-utils/types/file-data";
import { hasRedirect, type TabChild } from "@fern-api/fdr-sdk/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { Lock } from "lucide-react";
import { cn } from "./cn";
import { FernLinkTab } from "./FernLinkTab";
import { processIcon } from "./processIcon";

export function HeaderTabsList({
    tabs,
    children,
    files
}: {
    tabs: readonly TabChild[];
    children?: React.ReactNode;
    files?: Record<string, FileData>;
}) {
    return (
        <Tabs.TabsList>
            {tabs.map((tab) => (
                <Tabs.TabsTrigger key={tab.id} value={tab.id} asChild>
                    <FernLinkTab
                        className={cn({ "opacity-50": tab.type !== "link" && tab.hidden })}
                        href={tab.type === "link" ? tab.url : slugToHref(hasRedirect(tab) ? tab.pointsTo : tab.slug)}
                        scroll={true}
                        id={tab.id}
                        target={tab.type === "link" ? tab.target : undefined}
                    >
                        {tab.type !== "link" && tab.authed ? <Lock /> : processIcon({ node: tab, files })}
                        <span className="truncate">{tab.title}</span>
                    </FernLinkTab>
                </Tabs.TabsTrigger>
            ))}
            {children}
        </Tabs.TabsList>
    );
}
