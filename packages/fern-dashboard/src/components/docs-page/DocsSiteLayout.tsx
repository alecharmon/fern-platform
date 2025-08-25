import { GlobeIcon } from "lucide-react";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";

import { PageHeader } from "../layout/PageHeader";
import { StatusBadge } from "../ui/StatusBadge";
import { Button } from "../ui/button";
import { DocsSiteClientWrapper } from "./DocsSiteClientWrapper";
import { DocsSiteNavBar } from "./DocsSiteNavBar";

export declare namespace DocsSiteLayout {
  export interface Props {
    docsUrl: DocsUrl;
    orgName: Auth0OrgName;
    children: React.JSX.Element;
  }
}

export async function DocsSiteLayout({
  docsUrl,
  orgName,
  children,
}: DocsSiteLayout.Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <PageHeader
        title={<span className="break-all">{docsUrl}</span>}
        titleRightContent={<StatusBadge status="live" />}
        farRightContent={
          docsUrl && (
            <Button variant="default" asChild>
              <a
                href={new URL(`https://${docsUrl}`).toString()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="sr-only">{docsUrl}</span>
                <GlobeIcon className="h-4 w-4" />
                Visit
              </a>
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-4">
        <DocsSiteNavBar orgName={orgName} />
        <div className="flex">
          <DocsSiteClientWrapper docsUrl={docsUrl}>
            {children}
          </DocsSiteClientWrapper>
        </div>
      </div>
    </div>
  );
}
