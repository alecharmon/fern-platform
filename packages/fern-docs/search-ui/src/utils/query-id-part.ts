import type { UIDataTypes, UIMessagePart, UITools } from "ai";

export const isQueryIdPart = (
    part: UIMessagePart<UIDataTypes, UITools>
): part is { type: "data-assistant-query-id"; data: string } => {
    return part.type === "data-assistant-query-id" && "data" in part && typeof (part as any).data === "string";
};
