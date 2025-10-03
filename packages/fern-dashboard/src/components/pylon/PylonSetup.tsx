"use client";

import { useEffect } from "react";

import { Auth0User } from "@/app/services/auth0/types";

import "./PylonSetup.scss";
import { HIDE_PYLON_CLASS_NAME } from "./constants";
import { getPylon } from "./getPylon";

export declare namespace PylonSetup {
    export interface Props {
        user: Auth0User;
        emailHash: string | undefined;
    }
}

export function PylonSetup({ user, emailHash }: PylonSetup.Props) {
    useEffect(() => {
        (window as any).pylon = {
            chat_settings: {
                app_id: process.env.NEXT_PUBLIC_PYLON_APP_ID,
                email: user.email,
                name: user.name,
                avatar_url: user.picture,
                email_hash: emailHash
            }
        };
    }, [emailHash, user.email, user.name, user.picture]);

    useEffect(() => {
        getPylon()?.("onShow", () => {
            removeHidePylonClassFromBody();
            getPylon()?.("onShow", null);
        });

        return () => {
            getPylon()?.("onShow", null);
        };
    }, []);

    /**
     * chat bubble behavior:
     *   1. when the page loads:
     *      if the user has unread messages, the chat bubble should be visible
     *      if the user does not have unread messages, the chat bubble should not be visible
     *   2. when a new message comes in, the chat bubble should be visible
     *      (no-op in the case where the chat bubble is already visible)
     *   3. once the chat bubble is visible at any point (either from an unread
     *      message or the user clicking the Support button), the chat button should
     *      never be hidden (unless page is refreshed)
     * in order to get #3 working, we:
     *   - set "chat bubble is visible" in pylon UI
     *   - add the hide-pylon class to body initially
     *   - use the unread message count to set the initially visibility
     *   - remove the hyde-pylon class from body
     */
    useEffect(() => {
        let timeout: NodeJS.Timeout | undefined;

        getPylon()?.("onChangeUnreadMessagesCount", (unreadCount) => {
            if (unreadCount > 0) {
                getPylon()?.("showChatBubble");
                removeHidePylonClassFromBody();
            } else {
                // need to wrap this in a timeout because getPylon()?.("hideChatBubble")
                // doesn't work for the first couple seconds after pylon is initiated
                timeout = setTimeout(() => {
                    if (document.getElementById("body")?.classList.contains(HIDE_PYLON_CLASS_NAME)) {
                        getPylon()?.("hideChatBubble");
                        removeHidePylonClassFromBody();
                    }
                }, 2_000);
            }
        });

        return () => {
            getPylon()?.("onChangeUnreadMessagesCount", null);
            clearTimeout(timeout);
        };
    }, []);

    return null;
}

function removeHidePylonClassFromBody() {
    document.getElementById("body")?.classList.remove(HIDE_PYLON_CLASS_NAME);
}
