import { FdrAPI } from "@fern-api/fdr-sdk";
import { inject } from "vitest";

import { CHAT_COMPLETION_PAYLOAD, CHAT_COMPLETION_SNIPPET } from "../../octo";
import { getClient, getTemplatesClient } from "../util";

const ENDPOINT: FdrAPI.EndpointIdentifier = {
    path: FdrAPI.EndpointPathLiteral("/users/v1"),
    method: "GET",
    identifierOverride: undefined
};
const SDK: FdrAPI.Sdk = {
    type: "go",
    githubRepo: "https://github.com/users-api/users-go",
    version: "0.0.15"
};

it("create snippet template", async () => {
    const unauthedTemplates = getTemplatesClient({ authed: false, url: inject("url") });
    const authedTemplates = getTemplatesClient({ authed: true, url: inject("url") });

    const orgId = "acme";

    // register API definition for acme org
    await unauthedTemplates.register({
        orgId,
        apiId: "user",
        apiDefinitionId: "....",
        snippet: {
            endpointId: ENDPOINT,
            sdk: SDK,
            snippetTemplate: {
                type: "v1",
                clientInstantiation: "client := userclient.New()",
                functionInvocation: {
                    type: "generic",
                    templateString: "client.GetUsers()",
                    isOptional: false,
                    imports: undefined,
                    templateInputs: undefined,
                    inputDelimiter: undefined
                }
            },
            additionalTemplates: undefined
        }
    });
    // get snippet template
    const response = await authedTemplates.get({
        orgId,
        apiId: "user",
        endpointId: ENDPOINT,
        sdk: SDK
    });
    console.log(JSON.stringify(response, null, 2));
    expect(response).toBeDefined();
    expect((response as Record<string, unknown>).endpointId).toEqual(ENDPOINT);
});

it("generate example from snippet template", async () => {
    const unauthedTemplates = getTemplatesClient({ authed: false, url: inject("url") });
    const authedTemplates = getTemplatesClient({ authed: true, url: inject("url") });
    const fdr = getClient({ authed: true, url: inject("url") });

    const orgId = "octoai";
    const apiId = "api";
    const sdk: FdrAPI.Sdk = {
        type: "python",
        package: "octoai",
        version: "0.0.5"
    };

    // register API definition for octoai org
    await unauthedTemplates.register({
        orgId,
        apiId,
        apiDefinitionId: "....",
        snippet: CHAT_COMPLETION_SNIPPET("0.0.5")
    });
    // get snippet template
    await authedTemplates.get({
        orgId,
        apiId,
        endpointId: CHAT_COMPLETION_SNIPPET("0.0.5").endpointId,
        sdk
    });

    const response = await fdr.snippets.get({
        orgId: FdrAPI.OrgId(orgId),
        apiId: FdrAPI.ApiId(apiId),
        endpoint: CHAT_COMPLETION_SNIPPET("0.0.5").endpointId,
        sdks: [sdk],
        payload: CHAT_COMPLETION_PAYLOAD
    });
    expect(response.ok).toBe(true);
    console.log(JSON.stringify(response, null, 2));
});

it("fallback to version", async () => {
    const unauthedTemplates = getTemplatesClient({ authed: false, url: inject("url") });
    const authedTemplates = getTemplatesClient({ authed: true, url: inject("url") });

    const orgId = "octoai";
    const apiId = "api";
    const sdk: FdrAPI.Sdk = {
        type: "python",
        package: "octoai",
        version: "0.0.6"
    };
    const genericRequest: FdrAPI.SdkRequest = {
        type: "python",
        package: "octoai",
        version: undefined
    };

    // register API definition for octoai org
    await unauthedTemplates.register({
        orgId,
        apiId,
        apiDefinitionId: "....",
        snippet: CHAT_COMPLETION_SNIPPET("0.0.6")
    });
    // get snippet template
    const template = (await authedTemplates.get({
        orgId,
        apiId,
        endpointId: CHAT_COMPLETION_SNIPPET("0.0.6").endpointId,
        sdk: genericRequest
    })) as Record<string, unknown>;
    expect((template.sdk as Record<string, unknown>).version).toBe("0.0.6");

    // register API definition for octoai org
    await unauthedTemplates.register({
        orgId,
        apiId,
        apiDefinitionId: "....",
        snippet: CHAT_COMPLETION_SNIPPET("0.0.122")
    });
    // get snippet template
    const templateAgain = (await authedTemplates.get({
        orgId,
        apiId,
        endpointId: CHAT_COMPLETION_SNIPPET("0.0.122").endpointId,
        sdk: genericRequest
    })) as Record<string, unknown>;
    expect((templateAgain.sdk as Record<string, unknown>).version).toBe("0.0.122");

    const templateSpecify = (await authedTemplates.get({
        orgId,
        apiId,
        endpointId: CHAT_COMPLETION_SNIPPET("0.0.6").endpointId,
        sdk
    })) as Record<string, unknown>;
    expect(templateSpecify).toBeDefined();
    expect((templateSpecify.sdk as Record<string, unknown>).version).toBe("0.0.6");
});
