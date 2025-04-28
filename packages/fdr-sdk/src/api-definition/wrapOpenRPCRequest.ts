/**
 * Wraps a request body in the OpenRPC format.
 *
 * @param body - The request body to wrap
 * @param methodName - The OpenRPC method name
 * @returns The wrapped request body in OpenRPC format
 */
export function wrapOpenRPCRequest(
  body: unknown,
  methodName: string
): {
  jsonrpc: string;
  method: string;
  params: unknown[];
  id: number;
} {
  let params: unknown[] = [];
  if (body && typeof body === "object") {
    params = Object.values(body);
  }
  return {
    jsonrpc: "2.0",
    method: methodName,
    params,
    id: 1,
  };
}
