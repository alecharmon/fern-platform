import {
  SnippetHttpRequest,
  SnippetHttpRequestBodyFormValue,
  convertToCurl,
} from "@fern-api/fdr-sdk/api-definition";
import { visitDiscriminatedUnion } from "@fern-api/ui-core-utils";

import { convertPlaygroundFormDataEntryValueToResolvedExampleEndpointRequest } from "../../types";
import { PlaygroundCodeSnippetBuilder } from "./types";

export class CurlSnippetBuilder extends PlaygroundCodeSnippetBuilder {
  private isFileForgeHackEnabled = false;

  public setFileForgeHackEnabled(isFileForgeHackEnabled: boolean): this {
    this.isFileForgeHackEnabled = isFileForgeHackEnabled;
    return this;
  }

  public override build(): string {
    // If the endpoint protocol is OpenRPC, ensure we add the application/json Content-Type header
    if (this.context.endpoint.protocol?.type === "openrpc") {
      // Create a copy of the headers to avoid mutating the original object
      const headers = { ...this.formState.headers };
      // Add or override the Content-Type header
      headers["Content-Type"] = "application/json";
      this.formState = {
        ...this.formState,
        headers,
      };
    }

    return convertToCurl(
      {
        method: this.context.endpoint.method,
        url: this.url,
        searchParams: this.formState.queryParameters,
        headers: this.formState.headers,
        basicAuth:
          this.context.auth?.type === "basicAuth"
            ? this.authState.basicAuth
            : undefined,
        body: this.#convertFormStateToBody(),
        redacted: this.redacted,
      },
      { usesApplicationJsonInFormDataValue: this.isFileForgeHackEnabled }
    );
  }

  #convertFormStateToBody(): SnippetHttpRequest["body"] {
    if (this.formState.body == null) {
      return undefined;
    }
    return visitDiscriminatedUnion(this.formState.body, "type")._visit<
      SnippetHttpRequest["body"]
    >({
      json: ({ value }) => ({
        type: "json",
        value: this.maybeWrapJsonBody(value),
      }),
      "form-data": ({ value }) => {
        const newValue: Record<string, SnippetHttpRequestBodyFormValue> = {};
        for (const [key, v] of Object.entries(value)) {
          const convertedV =
            convertPlaygroundFormDataEntryValueToResolvedExampleEndpointRequest(
              v
            );
          if (convertedV != null) {
            newValue[key] = convertedV;
          }
        }
        if (Object.keys(newValue).length === 0) {
          return undefined;
        }
        return { type: "form", value: newValue };
      },
      "octet-stream": ({ value }) =>
        value != null ? { type: "bytes", filename: value.name } : undefined,
      _other: () => undefined,
    });
  }
}
