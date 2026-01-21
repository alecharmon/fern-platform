"use server";

import { constructEditorSlug, generateBranchName, ROOT_SLUG_ALIAS } from "@fern-docs/components/navigation";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { doesUserBelongToOrg } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { EncodedDocsUrl } from "@/utils/types";

interface OpenFernEditorParams {
    orgName: Auth0OrgName;
    docsUrl: string;
    slug: string;
}

export async function openFernEditor({ orgName, docsUrl, slug }: OpenFernEditorParams): Promise<void> {
    const session = await getCurrentSession();

    if (session == null) {
        redirect("/login");
    }

    const isMember = await doesUserBelongToOrg(session.user.sub, orgName);

    if (!isMember) {
        redirect("/");
    }

    const branchName = generateBranchName(session.user.sub, session.user.name);

    const editorUrl = constructEditorSlug({
        orgName,
        docsUrl: encodeURIComponent(docsUrl) as EncodedDocsUrl,
        branchName,
        slug: slug === "" ? ROOT_SLUG_ALIAS : slug
    });

    redirect(editorUrl);
}
