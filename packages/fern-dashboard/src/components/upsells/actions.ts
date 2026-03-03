"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { getPylon } from "@/components/pylon/getPylon";

import type { UpsellAction } from "./types";

interface ActionContext {
    orgName: string;
    router: AppRouterInstance;
}

/**
 * Execute the appropriate action based on the UpsellAction config.
 * - redirect: pushes to the billing page (href is relative to org)
 * - checkout: pushes to the billing page (checkout is handled there)
 * - contact-sales: opens the sales URL in a new tab
 * - pylon: opens the Pylon support chat widget
 */
export function executeUpsellAction(action: UpsellAction, ctx: ActionContext): void {
    switch (action.type) {
        case "redirect": {
            ctx.router.push(`/${ctx.orgName}${action.href}`);
            break;
        }
        case "checkout": {
            // For now, redirect to billing page. The inline checkout flow
            // will be handled by custom content components per feature.
            ctx.router.push(`/${ctx.orgName}/billing`);
            break;
        }
        case "contact-sales": {
            window.open(action.href, "_blank", "noopener,noreferrer");
            break;
        }
        case "pylon": {
            if (action.message) {
                getPylon()?.("showNewMessage", action.message);
            } else {
                getPylon()?.("show");
            }
            getPylon()?.("showChatBubble");
            break;
        }
    }
}
