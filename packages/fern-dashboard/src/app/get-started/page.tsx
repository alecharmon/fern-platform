import { redirect } from "next/navigation";

import { DocsZeroState } from "@/components/docs-page/DocsZeroState";
import { AppLayout } from "@/components/layout/AppLayout";
import { SidepanelProvider } from "@/components/layout/SidepanelContext";

import HeaderLayout from "../[orgName]/(homepage)/@header/default";
import { getCurrentSession } from "../services/auth0/getCurrentSession";

export default async function Page({ params }: { params: Promise<{}> }) {
  const session = await getCurrentSession();
  if (session == null) {
    redirect("/");
  }

  return (
    <SidepanelProvider>
      <AppLayout
        sidepanel={null}
        navbar={null}
        header={<HeaderLayout params={params} />}
      >
        <DocsZeroState user={session.user} />
      </AppLayout>
    </SidepanelProvider>
  );
}
