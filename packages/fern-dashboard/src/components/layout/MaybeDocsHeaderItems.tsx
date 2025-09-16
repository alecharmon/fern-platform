import "server-only";

import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";

import { DocsSiteSwitcher } from "./DocsSiteSwitcher";

export async function MaybeDocsHeaderItems({
  docsUrl,
  orgName,
}: Readonly<{ docsUrl?: DocsUrl; orgName: Auth0OrgName }>) {
  if (docsUrl == null) {
    return null;
  }
  return (
    <>
      <div className="flex items-center md:hidden">/</div>
      <div className="flex min-w-0 md:hidden">
        <DocsSiteSwitcher orgName={orgName} docsUrl={docsUrl} />
      </div>
    </>
  );
}
