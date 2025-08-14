import { redirect } from "next/navigation";

import getDocsGithubSourceHandler from "@/app/api/get-docs-github-source/handler";
import getMyDocsSitesHandler from "@/app/api/get-my-docs-sites/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0OrgName } from "@/app/services/auth0/types";
import { DocsSiteOverviewCard } from "@/components/docs-page/DocsSiteOverviewCard";
import { GithubProtectedArea } from "@/components/docs-page/GithubProtectedArea";
import { GithubSource } from "@/components/docs-page/GithubSource";
import { PosthogFeatureFlag } from "@/components/posthog/feature-flags/flags";
import { FeatureFlaggedServerSide } from "@/components/posthog/feature-flags/server-side";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import { EncodedDocsUrl } from "@/utils/types";

export default async function Page(props: {
  params: Promise<{ orgName: Auth0OrgName; docsUrl: EncodedDocsUrl }>;
}) {
  const { orgName, docsUrl: encodedDocsUrl } = await props.params;
  const docsUrl = parseDocsUrlParam({ docsUrl: encodedDocsUrl });
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  // Validate that the docsUrl belongs to this organization so that we avoid errors in the page
  try {
    const docsSites = await getMyDocsSitesHandler({
      orgName,
      token: session.accessToken,
    });

    const docsUrlsInOrg = docsSites.docsSites.map((site) =>
      getDocsSiteUrl(site)
    );
    const isValidDocsUrl = docsUrlsInOrg.includes(docsUrl);

    if (!isValidDocsUrl) {
      redirect(`/${orgName}/docs`);
    }
  } catch (_error) {
    // If we can't validate (e.g., permission issues), redirect to docs overview
    redirect(`/${orgName}/docs`);
  }

  const sourceRepo = await getDocsGithubSourceHandler({
    orgName,
    url: encodedDocsUrl,
    token: session.accessToken,
    userId: session.user.sub,
  });

  return (
    <FeatureFlaggedServerSide
      flag={PosthogFeatureFlag.ENABLE_DOCS_PAGE}
      redirectWhenDisabled
      orgName={orgName}
    >
      <DocsSiteOverviewCard
        docsUrl={docsUrl}
        githubProtectedArea={
          <div className="flex w-fit flex-col gap-2">
            <p>Source</p>
            <GithubProtectedArea sourceRepo={sourceRepo} orgName={orgName}>
              <GithubSource
                docsUrl={docsUrl}
                orgName={orgName}
                session={session}
              />
            </GithubProtectedArea>
          </div>
        }
      />
    </FeatureFlaggedServerSide>
  );
}
