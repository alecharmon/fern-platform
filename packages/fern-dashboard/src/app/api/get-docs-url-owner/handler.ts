import { Auth0OrgName } from "@/app/services/auth0/types";

import { getDocsUrlMetadata } from "../utils/getDocsUrlMetadata";

export default async function getDocsUrlOwnerHandler({
    url,
    token
}: {
    url: string;
    token: string;
}): Promise<{ orgName: Auth0OrgName | undefined }> {
    const docsUrlMetadata = await getDocsUrlMetadata({ url, token });
    if (!docsUrlMetadata.ok) {
        // the docs url is user-supplied (parsed from the page url) so it's ok if it
        // doesn't exist
        if (docsUrlMetadata.error.error === "DomainNotRegisteredError") {
            return { orgName: undefined };
        }

        console.error("Failed to load docs URL metadata", JSON.stringify(docsUrlMetadata.error));
        throw new Error("Failed to load docs URL metadata");
    }

    return {
        orgName: Auth0OrgName(docsUrlMetadata.body.org)
    };
}
