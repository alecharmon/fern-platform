import { FdrAPI } from "@fern-api/fdr-sdk";
import { createDashboardClient } from "@fern-api/fdr-sdk/orpc-client";
import { inject } from "vitest";

import { getAPIResponse, getClient } from "../util";
import { WRITE_DOCS_REGISTER_DEFINITION } from "./docs.test";

it("get my docs sties", async () => {
    const fdr = getClient({ authed: true, url: inject("url") });

    const startDocsRegisterResponse = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("dashboard-org"),
            apiId: FdrAPI.ApiId("api-1"),
            domain: "https://dashboard-org.docs.buildwithfern.com",
            customDomains: ["www.dashboard-org.com", "www.dashboard-org.com/docs"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    const startDocsRegisterResponse2 = getAPIResponse(
        await fdr.docs.v2.write.startDocsRegister({
            orgId: FdrAPI.OrgId("dashboard-org"),
            apiId: FdrAPI.ApiId("api-2"),
            domain: "https://dashboard-org-2.docs.buildwithfern.com",
            customDomains: ["www.dashboard-org-2.com", "www.dashboard-org-2.com/docs"],
            filepaths: []
        })
    );
    await fdr.docs.v2.write.finishDocsRegister(startDocsRegisterResponse2.docsRegistrationId, {
        docsDefinition: WRITE_DOCS_REGISTER_DEFINITION
    });

    const dashboardClient = createDashboardClient({
        baseUrl: inject("url"),
        token: "dummy"
    });
    const docsSites = await dashboardClient.getDocsSitesForOrg({
        orgId: "dashboard-org"
    });

    expect(docsSites).toEqual({
        docsSites: [
            {
                mainUrl: {
                    domain: "www.dashboard-org-2.com",
                    path: ""
                },
                urls: [
                    {
                        domain: "www.dashboard-org-2.com",
                        path: ""
                    },
                    {
                        domain: "www.dashboard-org-2.com",
                        path: "/docs"
                    },
                    {
                        domain: "dashboard-org-2.docs.buildwithfern.com",
                        path: ""
                    }
                ]
            },
            {
                mainUrl: {
                    domain: "www.dashboard-org.com",
                    path: ""
                },
                urls: [
                    {
                        domain: "www.dashboard-org.com",
                        path: ""
                    },
                    {
                        domain: "www.dashboard-org.com",
                        path: "/docs"
                    },
                    {
                        domain: "dashboard-org.docs.buildwithfern.com",
                        path: ""
                    }
                ]
            }
        ]
    });
});
