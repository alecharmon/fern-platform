import { isAskAiEnabled } from "@/app/actions/toggleAskAi";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsUrl } from "@/utils/types";

import { ArchiveSiteButton } from "./ArchiveSiteButton";
import { ToggleAskAiButton } from "./ToggleAskAiButton";

export async function Settings({
  docsUrl,
  hasFernEmail,
  orgName,
}: {
  docsUrl: DocsUrl;
  orgName: Auth0OrgName;
  hasFernEmail: boolean;
}) {
  const askAiStatus = hasFernEmail
    ? await isAskAiEnabled({ domain: docsUrl })
    : null;

  return (
    <div className="flex flex-1 flex-col items-center gap-4">
      <div className="border-border mx-auto mt-6 flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4 sm:mt-8 md:mt-10">
        <div className="flex flex-col gap-1">
          <div className="font-bold">Archive site</div>
          <div className="text-gray-900">
            This will hide the site from the dashboard, but any deployed domains
            will remain live.
          </div>
        </div>
        <div className="mt-5 flex justify-center md:justify-end">
          <ArchiveSiteButton docsUrl={docsUrl} orgName={orgName} />
        </div>
      </div>
      {hasFernEmail && (
        <div className="border-border mx-auto mt-6 flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4 sm:mt-8 md:mt-10">
          <div className="flex flex-col gap-1">
            <div className="font-bold">Ask AI</div>
            <div className="text-gray-900">
              This will turn on or turn off AI search for this documentation
              site.
            </div>
          </div>
          <div className="mt-5 flex justify-center md:justify-end">
            <ToggleAskAiButton
              docsUrl={docsUrl}
              initialAskAiStatus={askAiStatus}
            />
          </div>
        </div>
      )}
    </div>
  );
}
