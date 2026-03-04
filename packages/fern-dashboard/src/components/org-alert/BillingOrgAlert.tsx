"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { createCheckoutSession } from "@/app/actions/billing/createCheckoutSession";
import { createPortalSession } from "@/app/actions/billing/createPortalSession";
import { revalidateBillingAlert } from "@/app/actions/billing/revalidateBillingAlert";
import { syncAfterCheckout } from "@/app/actions/billing/syncAfterCheckout";
import { useCurrentOrganization } from "@/state/useOrganizations";

import { OrgAlert, type OrgAlertProps } from "./OrgAlert";

type BillingOrgAlertProps = Omit<OrgAlertProps, "onAction" | "loading"> & {
    actionType: "checkout" | "portal";
    userEmail?: string;
};

export function BillingOrgAlert({ actionType, userEmail, ...props }: BillingOrgAlertProps) {
    const org = useCurrentOrganization();
    const router = useRouter();
    const [isOpening, setIsOpening] = useState(false);
    const portalReturnListenerRef = useRef<(() => void) | null>(null);
    const popupRef = useRef<Window | null>(null);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (portalReturnListenerRef.current) {
                window.removeEventListener("focus", portalReturnListenerRef.current);
            }
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    const handlePopupClosed = useCallback(async () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        if (!org) {
            return;
        }
        await syncAfterCheckout({ orgId: org.id, orgName: org.name });
        await revalidateBillingAlert(org.id);
        router.refresh();
    }, [org, router]);

    const handleAction = async () => {
        if (!org) {
            return;
        }

        if (actionType === "checkout") {
            if (!userEmail) {
                return;
            }
            setIsOpening(true);
            try {
                const result = await createCheckoutSession({
                    orgId: org.id,
                    orgName: org.name,
                    orgDisplayName: org.display_name || org.name,
                    orgSlug: org.name,
                    userEmail,
                    billingCycle: "yearly"
                });
                if (!("error" in result)) {
                    const popup = window.open(result.url, "stripe-checkout", "popup,width=600,height=700");
                    if (popup == null) {
                        window.location.href = result.url;
                        return;
                    }
                    popupRef.current = popup;
                    pollIntervalRef.current = setInterval(() => {
                        if (popup.closed) {
                            popupRef.current = null;
                            handlePopupClosed();
                        }
                    }, 500);
                }
            } catch (error) {
                console.error("Failed to open checkout:", error);
            } finally {
                setIsOpening(false);
            }
        } else {
            setIsOpening(true);
            try {
                const result = await createPortalSession({
                    orgId: org.id,
                    orgName: org.name,
                    orgSlug: org.name
                });
                if (!("error" in result)) {
                    window.open(result.url, "_blank", "noopener,noreferrer");
                    if (portalReturnListenerRef.current) {
                        window.removeEventListener("focus", portalReturnListenerRef.current);
                    }
                    const onReturn = async () => {
                        await revalidateBillingAlert(org.id);
                        router.refresh();
                        window.removeEventListener("focus", onReturn);
                        portalReturnListenerRef.current = null;
                    };
                    portalReturnListenerRef.current = onReturn;
                    window.addEventListener("focus", onReturn);
                }
            } catch (error) {
                console.error("Failed to open billing portal:", error);
            } finally {
                setIsOpening(false);
            }
        }
    };

    return <OrgAlert {...props} onAction={handleAction} loading={isOpening} />;
}
