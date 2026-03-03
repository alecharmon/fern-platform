interface Pylon {
    (arg: "show" | "hide" | "showChatBubble" | "hideChatBubble"): void;
    (arg: "showNewMessage", message: string): void;
    (arg: "onChangeUnreadMessagesCount", listener: ((unreadCount: number) => void) | null): void;
    (arg: "onShow" | "onHide", listener: (() => void) | null): void;
}

export function getPylon(): Pylon | undefined {
    return (window as any).Pylon;
}
