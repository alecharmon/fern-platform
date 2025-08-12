import { dynamic } from "@fern-api/dynamic-ir-sdk/api";

import { HttpMethodSchema } from "./HttpMethodSchema";

export declare namespace HttpEndpointReferenceParser {
  export type ValidationResult = Valid | Invalid;

  interface Valid {
    type: "valid";
  }

  interface Invalid {
    type: "invalid";
  }
}

/**
 * Parses an HTTP endpoint reference like `POST /users/get`
 */
export class HttpEndpointReferenceParser {
  private REFERENCE_REGEX =
    /^(GET|POST|PUT|DELETE|PATCH)\s(\/[a-zA-Z0-9/{}_-]*)$/;

  public validate(
    reference: string
  ): HttpEndpointReferenceParser.ValidationResult {
    const validFormat = this.REFERENCE_REGEX.test(reference);
    if (!validFormat) {
      return { type: "invalid" };
    }
    return { type: "valid" };
  }

  public tryParse(reference: string): dynamic.EndpointLocation | undefined {
    const validationResponse = this.validate(reference);
    if (validationResponse.type === "invalid") {
      return undefined;
    }
    const match = reference.match(this.REFERENCE_REGEX);
    if (!match?.[1] || !match?.[2]) {
      return undefined;
    }
    return {
      method: match[1] as HttpMethodSchema,
      path: match[2],
    };
  }
}
