import type { FC } from "react";

import { WebSocketMessages, type WebSocketMessagesProps } from "./WebSocketMessages";

export const WebSocketMessagesVirtualized: FC<WebSocketMessagesProps> = ({ messages }) => {
    return <WebSocketMessages messages={messages} virtualized />;
};
