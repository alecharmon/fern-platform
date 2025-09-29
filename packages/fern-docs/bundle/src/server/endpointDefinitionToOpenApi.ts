import { dump as yamlStringify } from "js-yaml";
import { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

import { ApiDefinition } from "@fern-api/fdr-sdk";
import type { TypeShapeOrReference } from "@fern-api/fdr-sdk/api-definition";
import { assertNever } from "@fern-api/ui-core-utils";

type ApiShapeTypes =
  | TypeShapeOrReference
  | ApiDefinition.HttpRequestBodyShape
  | ApiDefinition.HttpResponseBodyShape;

// This bridges the gap between OpenAPIV3 and OpenAPIV3_1 types
type ParameterCompatibleSchema =
  | OpenAPIV3.SchemaObject
  | OpenAPIV3.ReferenceObject;

/**
 * Class to take an endpoint defintion and return the to YAML formatting of its OpenAPI spec
 * The main funciton is generateYamlFromEndpoint
 */
export class OpenApiYamlFormatter {
  public generateYamlFromEndpoint(
    endpoint: ApiDefinition.EndpointDefinition,
    apiDefinition?: ApiDefinition.ApiDefinition
  ): string {
    const endpointPath = ApiDefinition.toCurlyBraceEndpointPathLiteral(
      endpoint.path
    );
    const method = endpoint.method.toLowerCase() as OpenAPIV3_1.HttpMethods;

    const context = {
      endpoint,
      types: apiDefinition?.types || {},
      auth:
        apiDefinition?.auths &&
        endpoint.auth &&
        endpoint.auth.length > 0 &&
        endpoint.auth[0]
          ? apiDefinition.auths[endpoint.auth[0]]
          : undefined,
      globalHeaders: apiDefinition?.globalHeaders,
      apiDefinition,
    };

    const openApiSpec = generateOpenApiFromEndpointContext(
      context,
      endpointPath,
      method
    );

    return yamlStringify(openApiSpec);
  }
}

export interface EndpointContext {
  endpoint: ApiDefinition.EndpointDefinition;
  types: Record<string, ApiDefinition.TypeDefinition>;
  auth?: ApiDefinition.AuthScheme;
  globalHeaders?: ApiDefinition.ObjectProperty[];
  apiDefinition?: ApiDefinition.ApiDefinition;
}

export function createOpenApiParameter(
  property: ApiDefinition.ObjectProperty,
  location: "query" | "header" | "path",
  apiDefinition?: ApiDefinition.ApiDefinition
): OpenAPIV3_1.ParameterObject {
  return {
    name: property.key,
    in: location,
    description: property.description,
    required: !isOptional(property.valueShape),
    schema: convertToOpenApiSchema(
      property.valueShape,
      apiDefinition
    ) as ParameterCompatibleSchema,
  };
}

export function createAuthHeaderParameter(
  auth: ApiDefinition.AuthScheme,
  apiDefinition?: ApiDefinition.ApiDefinition
): OpenAPIV3_1.ParameterObject | null {
  const stringShape: ApiDefinition.TypeShape = {
    type: "alias",
    value: {
      type: "primitive",
      value: {
        type: "string",
        format: undefined,
        regex: undefined,
        minLength: undefined,
        maxLength: undefined,
        default: undefined,
      },
    },
  };

  switch (auth.type) {
    case "basicAuth":
      return {
        name: "Authorization",
        in: "header",
        description:
          auth.description ??
          "Basic authentication of the form `Basic <username:password>`.",
        required: true,
        schema: convertToOpenApiSchema(
          stringShape,
          apiDefinition
        ) as ParameterCompatibleSchema,
      };
    case "bearerAuth":
      return {
        name: "Authorization",
        in: "header",
        description:
          auth.description ??
          "Bearer authentication of the form `Bearer <token>`, where token is your auth token.",
        required: true,
        schema: convertToOpenApiSchema(
          stringShape,
          apiDefinition
        ) as ParameterCompatibleSchema,
      };
    case "header":
      return {
        name: auth.headerWireValue,
        in: "header",
        description:
          auth.description || auth.prefix != null
            ? `Header authentication of the form \`${auth.prefix} <token>\``
            : undefined,
        required: true,
        schema: convertToOpenApiSchema(
          stringShape,
          apiDefinition
        ) as ParameterCompatibleSchema,
      };
    case "oAuth":
      // Mirror the complex OAuth handling from lines 95-115
      if (auth.value?.type === "clientCredentials") {
        const clientCredentials = auth.value.value;
        if (clientCredentials?.type === "referencedEndpoint") {
          return {
            name: clientCredentials.headerName || "Authorization",
            in: "header",
            description:
              clientCredentials.description ??
              `OAuth authentication of the form \`${clientCredentials.tokenPrefix ? `${clientCredentials.tokenPrefix ?? "Bearer"} ` : ""}<token>\`.`,
            required: true,
            schema: convertToOpenApiSchema(
              stringShape,
              apiDefinition
            ) as ParameterCompatibleSchema,
          };
        }
      }
      return {
        name: "Authorization",
        in: "header",
        description: "OAuth authentication",
        required: true,
        schema: convertToOpenApiSchema(
          stringShape,
          apiDefinition
        ) as ParameterCompatibleSchema,
      };
    default:
      assertNever(auth);
  }
}

function convertBodyToOpenApiContent(
  body:
    | ApiDefinition.HttpRequestBodyShape
    | ApiDefinition.HttpResponseBodyShape,
  apiDefinition?: ApiDefinition.ApiDefinition
): Record<string, OpenAPIV3_1.MediaTypeObject> {
  const content: Record<string, OpenAPIV3_1.MediaTypeObject> = {};

  switch (body.type) {
    case "object":
      content["application/json"] = {
        schema: convertToOpenApiSchema(body, apiDefinition),
      };
      break;
    case "alias":
      content["application/json"] = {
        schema: convertToOpenApiSchema(body.value, apiDefinition),
      };
      break;
    case "bytes":
      content["application/octet-stream"] = {
        schema: { type: "string", format: "binary" },
      };
      break;
    case "formData":
      content["multipart/form-data"] = {
        schema: {
          type: "object",
          properties: body.fields?.reduce<
            Record<
              string,
              OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject
            >
          >((acc, field) => {
            // Form data fields are actually just properties with key and valueShape
            if ("key" in field && "valueShape" in field) {
              acc[field.key] = convertToOpenApiSchema(
                field.valueShape,
                apiDefinition
              );
            }
            return acc;
          }, {}),
        },
      };
      break;
    case "fileDownload":
      content["application/octet-stream"] = {
        schema: { type: "string", format: "binary" },
      };
      break;
    case "streamingText":
      content["text/plain"] = {
        schema: { type: "string" },
      };
      break;
    case "stream": {
      let streamSchema: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject;
      if (body.shape) {
        streamSchema = convertToOpenApiSchema(body.shape, apiDefinition);
      } else {
        // Check if this stream body has a payload property (from legacy format)
        const bodyWithPayload = body as { payload?: ApiShapeTypes };
        if (bodyWithPayload.payload) {
          streamSchema = convertToOpenApiSchema(
            bodyWithPayload.payload,
            apiDefinition
          );
        } else {
          streamSchema = {
            type: "object",
            description: "Stream data",
          } as OpenAPIV3_1.SchemaObject;
        }
      }
      content["text/event-stream"] = {
        schema: streamSchema,
      };
      break;
    }
    case "empty":
      // No content for empty body
      break;
    default:
      assertNever(body);
  }

  return content;
}

function isOptional(shape: ApiDefinition.TypeShapeOrReference): boolean {
  switch (shape.type) {
    case "optional":
      return true;
    case "alias":
      return isOptional(shape.value);
    default:
      return false;
  }
}

function convertPrimitiveToSchema(
  primitive: ApiDefinition.PrimitiveType
): OpenAPIV3_1.SchemaObject {
  switch (primitive.type) {
    case "string":
      return { type: "string", format: primitive.format };
    case "integer":
      return { type: "integer" };
    case "double":
      return { type: "number", format: "double" };
    case "long":
      return { type: "integer", format: "int64" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date" };
    case "datetime":
      return { type: "string", format: "date-time" };
    case "uuid":
      return { type: "string", format: "uuid" };
    case "base64":
      return { type: "string", format: "base64" };
    case "bigInteger": // TODO: is this ok?
      return { type: "integer", format: "int64" };
    case "uint":
      return { type: "integer", format: "uint" };
    case "uint64":
      return { type: "integer", format: "uint64" };
    default:
      assertNever(primitive);
  }
}

function buildPropertiesAndRequired(
  shape:
    | ApiDefinition.TypeShape.Object_
    | ApiDefinition.TypeShape.DiscriminatedUnion,
  apiDefinition?: ApiDefinition.ApiDefinition,
  initialProperties: Record<
    string,
    OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject
  > = {},
  initialRequired: string[] = []
): {
  properties: Record<
    string,
    OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject
  >;
  required: string[];
} {
  const properties = { ...initialProperties };
  const required = [...initialRequired];

  // First, resolve properties from extended types
  if (
    shape.type === "object" &&
    shape.extends &&
    shape.extends.length > 0 &&
    apiDefinition?.types
  ) {
    shape.extends.forEach((extendedTypeName: string) => {
      const extendedType =
        apiDefinition.types[extendedTypeName as ApiDefinition.TypeId];
      if (extendedType?.shape) {
        const extendedSchema = convertToOpenApiSchema(
          extendedType.shape,
          apiDefinition
        );
        if ("properties" in extendedSchema && extendedSchema.properties) {
          // Merge extended properties (current object properties will override these)
          Object.assign(properties, extendedSchema.properties);
        }
        if ("required" in extendedSchema && extendedSchema.required) {
          required.push(...extendedSchema.required);
        }
      }
    });
  }

  // Then, add/override with current object's properties
  if (shape.type === "object" && shape.properties) {
    shape.properties.forEach((prop: ApiDefinition.ObjectProperty) => {
      const propSchema = convertToOpenApiSchema(prop.valueShape, apiDefinition);
      if (prop.description && "description" in propSchema) {
        propSchema.description = prop.description;
      }
      properties[prop.key] = propSchema;

      // Add to required array if not optional
      if (!isOptional(prop.valueShape)) {
        required.push(prop.key);
      }
    });
  }

  return {
    properties,
    required: Array.from(new Set(required)),
  };
}

function convertObjectToSchema(
  shape: ApiDefinition.TypeShape.Object_,
  apiDefinition?: ApiDefinition.ApiDefinition
): OpenAPIV3_1.SchemaObject {
  const { properties, required } = buildPropertiesAndRequired(
    shape,
    apiDefinition
  );

  const result: OpenAPIV3_1.SchemaObject = { type: "object", properties };
  if (required.length > 0) {
    result.required = required;
  }
  return result;
}

function convertDiscriminatedUnionToSchema(
  shape: ApiDefinition.TypeShape.DiscriminatedUnion,
  apiDefinition?: ApiDefinition.ApiDefinition
): OpenAPIV3_1.SchemaObject {
  const variants = shape.variants;
  if (!variants || variants.length === 0) {
    return { type: "object" };
  }

  const oneOfSchemas = variants.map(
    (variant: ApiDefinition.DiscriminatedUnionVariant) => {
      const initialProperties: Record<
        string,
        OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject
      > = {
        [shape.discriminant]: {
          type: "string",
          enum: [variant.discriminantValue],
          description: `Discriminator value: ${variant.discriminantValue}`,
        } as OpenAPIV3_1.SchemaObject,
      };
      const initialRequired = [shape.discriminant];

      const variantProperties = { ...initialProperties };
      const variantRequired = [...initialRequired];

      // First, resolve properties from extended types
      if (
        variant.extends &&
        variant.extends.length > 0 &&
        apiDefinition?.types
      ) {
        variant.extends.forEach((extendedTypeName: string) => {
          const extendedType =
            apiDefinition.types[
              extendedTypeName as keyof typeof apiDefinition.types
            ];
          if (extendedType?.shape) {
            const extendedSchema = convertToOpenApiSchema(
              extendedType.shape,
              apiDefinition
            );
            if ("properties" in extendedSchema && extendedSchema.properties) {
              Object.assign(variantProperties, extendedSchema.properties);
            }
            if (
              "required" in extendedSchema &&
              extendedSchema.required &&
              Array.isArray(extendedSchema.required)
            ) {
              const requiredFields =
                extendedSchema.required as ApiDefinition.PropertyKey[];
              variantRequired.push(...requiredFields);
            }
          }
        });
      }

      // Then, add/override with variant's own properties
      if (variant.properties) {
        variant.properties.forEach((prop: ApiDefinition.ObjectProperty) => {
          const propSchema = convertToOpenApiSchema(
            prop.valueShape,
            apiDefinition
          );
          if (prop.description && "description" in propSchema) {
            propSchema.description = prop.description;
          }
          variantProperties[prop.key] = propSchema;

          if (!isOptional(prop.valueShape)) {
            variantRequired.push(prop.key);
          }
        });
      }

      const properties = variantProperties;
      const required = Array.from(new Set(variantRequired));

      const description =
        variant.description ||
        (variant.displayName ? `${variant.displayName} variant` : undefined);

      return {
        type: "object",
        properties,
        required,
        ...(description && { description }),
      };
    }
  );

  return {
    oneOf: oneOfSchemas,
    discriminator: {
      propertyName: shape.discriminant,
    } as OpenAPIV3_1.DiscriminatorObject,
  } as OpenAPIV3_1.SchemaObject;
}

/**
 * Converts Fern type shape to OpenAPI schema, recursively calling helper functions
 */
function convertToOpenApiSchema(
  shape: ApiShapeTypes,
  apiDefinition?: ApiDefinition.ApiDefinition
): OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject {
  if (!shape) {
    return {} as OpenAPIV3_1.SchemaObject;
  }

  switch (shape.type) {
    case "primitive":
      return convertPrimitiveToSchema(shape.value);
    case "alias":
      return convertToOpenApiSchema(shape.value, apiDefinition);
    case "object":
      return convertObjectToSchema(shape, apiDefinition);
    case "list":
      return {
        type: "array",
        items: convertToOpenApiSchema(shape.itemShape, apiDefinition),
      };
    case "set":
      // Sets in OpenAPI are represented as arrays with uniqueItems: true
      return {
        type: "array",
        uniqueItems: true,
        items: convertToOpenApiSchema(shape.itemShape, apiDefinition),
      };
    case "map": {
      const valueSchema = convertToOpenApiSchema(
        shape.valueShape,
        apiDefinition
      );
      return {
        type: "object",
        additionalProperties: valueSchema,
      };
    }
    case "optional":
      return convertToOpenApiSchema(shape.shape, apiDefinition);
    case "nullable": {
      const baseSchema = convertToOpenApiSchema(shape.shape, apiDefinition);
      // In OpenAPI 3.1, we can use type arrays for nullable types
      const schemaObj = baseSchema as OpenAPIV3_1.SchemaObject;
      if (schemaObj.type && typeof schemaObj.type === "string") {
        return {
          ...schemaObj,
          type: [schemaObj.type, "null"],
        };
      }
      return {
        oneOf: [baseSchema, { type: "null" } as OpenAPIV3_1.SchemaObject],
      } as OpenAPIV3_1.SchemaObject;
    }
    case "enum":
      return { type: "string", enum: shape.values };
    case "literal":
      return {
        type: "string",
        enum: [shape.value],
      } as OpenAPIV3_1.SchemaObject;
    case "undiscriminatedUnion": {
      const variants =
        shape.variants || ("union" in shape ? shape.union : undefined);
      if (variants && variants.length > 0) {
        return {
          oneOf: variants.map(
            (
              variant: ApiDefinition.UndiscriminatedUnionVariant | ApiShapeTypes
            ) =>
              convertToOpenApiSchema(
                "shape" in variant ? variant.shape : variant,
                apiDefinition
              )
          ),
        } as OpenAPIV3_1.SchemaObject;
      }
      return {} as OpenAPIV3_1.SchemaObject;
    }
    case "discriminatedUnion":
      return convertDiscriminatedUnionToSchema(shape, apiDefinition);
    case "id":
      if (apiDefinition?.types?.[shape.id]) {
        const typeDef = apiDefinition.types[shape.id];
        if (typeDef) {
          const resolvedSchema = convertToOpenApiSchema(
            typeDef.shape,
            apiDefinition
          );
          if (typeDef.description) {
            // It's a schema object, we can safely add description
            const schemaObj = resolvedSchema as OpenAPIV3_1.SchemaObject;
            if (!schemaObj.description) {
              schemaObj.description = typeDef.description;
            }
          }
          return resolvedSchema;
        }
      }
      // Frontend would show this as the shape.id or "any"
      return {
        description: `Reference to ${shape.id}`,
      } as OpenAPIV3_1.SchemaObject;
    case "unknown":
      // Frontend shows this as "any"
      return {
        description: shape.displayName || "Any type",
      } as OpenAPIV3_1.SchemaObject;
    case "bytes":
      return { type: "string", format: "binary" };
    case "formData":
      return { type: "object", properties: {}, required: [] };
    case "empty":
      return { type: "object", properties: {}, required: [] };
    case "fileDownload":
      return { type: "string", format: "binary" };
    case "streamingText":
      return { type: "string" };
    case "stream":
      return { type: "object", properties: {}, required: [] };
    default:
      assertNever(shape);
  }
}

export function generateOpenApiFromEndpointContext(
  context: EndpointContext,
  path: string,
  method: string
): OpenAPIV3_1.Document {
  const {
    endpoint,
    types: _types,
    auth,
    globalHeaders,
    apiDefinition,
  } = context;

  const openApiSpec: OpenAPIV3_1.Document = {
    openapi: "3.1.1",
    info: {
      title: endpoint.displayName ?? "API",
      version: endpoint.id,
    },
    paths: {
      [path]: {
        [method as OpenAPIV3_1.HttpMethods]: {
          operationId: endpoint.operationId || endpoint.id,
          summary: endpoint.displayName || endpoint.id,
          description:
            typeof endpoint.description === "string"
              ? endpoint.description
              : undefined,
          tags: endpoint.namespace ? [endpoint.namespace] : undefined,
          parameters: [],
          responses: {},
        } as OpenAPIV3_1.OperationObject,
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const operation = openApiSpec.paths[path]![
    method as OpenAPIV3_1.HttpMethods
  ] as OpenAPIV3_1.OperationObject;

  if (endpoint.pathParameters && endpoint.pathParameters.length > 0) {
    endpoint.pathParameters.forEach((param: ApiDefinition.ObjectProperty) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      operation.parameters!.push(
        createOpenApiParameter(param, "path", apiDefinition)
      );
    });
  }

  if (endpoint.queryParameters && endpoint.queryParameters.length > 0) {
    endpoint.queryParameters.forEach((param: ApiDefinition.ObjectProperty) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      operation.parameters!.push(
        createOpenApiParameter(param, "query", apiDefinition)
      );
    });
  }

  let authHeader: OpenAPIV3_1.ParameterObject | null = null;
  if (auth) {
    authHeader = createAuthHeaderParameter(auth, apiDefinition);
  }

  const headers = [
    ...(authHeader ? [authHeader] : []),
    ...(globalHeaders || []),
    ...(endpoint.requestHeaders || []),
  ];

  headers.forEach((header) => {
    if ("name" in header && header.name) {
      // Already converted to OpenAPI parameter (auth header)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      operation.parameters!.push(header as OpenAPIV3_1.ParameterObject);
    } else {
      // Convert ObjectProperty to OpenAPI parameter
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      operation.parameters!.push(
        createOpenApiParameter(
          header as ApiDefinition.ObjectProperty,
          "header",
          apiDefinition
        )
      );
    }
  });

  if (endpoint.requests?.[0]?.body != null) {
    const request = endpoint.requests[0];
    operation.requestBody = {
      description: request.description,
      content: convertBodyToOpenApiContent(request.body, apiDefinition),
    };
  }

  if (endpoint.responses?.[0] != null) {
    const response = endpoint.responses[0];
    const statusCode = response.statusCode?.toString() || "200";

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    operation.responses![statusCode] = {
      description: response.description || `Response with status ${statusCode}`,
      content: response.body
        ? convertBodyToOpenApiContent(response.body, apiDefinition)
        : {},
    };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    operation.responses!["200"] = {
      description: "Successful response",
    };
  }

  if (endpoint.errors && endpoint.errors.length > 0) {
    endpoint.errors.forEach(
      (error: { statusCode?: number; description?: string }) => {
        const errorStatusCode = error.statusCode?.toString() || "400";
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        operation.responses![errorStatusCode] = {
          description:
            error.description ||
            `Error response with status ${errorStatusCode}`,
          content: {},
        };
      }
    );
  }

  return openApiSpec;
}
