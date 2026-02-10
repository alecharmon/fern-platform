import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAuthenticatedSessionOrRedirect } from "@/app/services/dal/organization";
import PdfExporterPage from "@/components/pdf-exporter/PdfExporterPage";
import type { DocsUrl } from "@/utils/types";

export default async function Page(props: { params: Promise<{ orgName: Auth0OrgName; docsUrl: DocsUrl }> }) {
    const params = await props.params;
    await getAuthenticatedSessionOrRedirect(params.orgName);

    return <PdfExporterPage docsUrl={params.docsUrl} orgName={params.orgName} />;
}
