"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect, useRef } from "react";
import { CALENDLY_URL_EMBED } from "@/components/onboarding/constants";
import { captureEvent, PosthogEventName } from "@/components/posthog/events";

interface BookADemoContentProps {
    email?: string;
    name?: string;
}

interface CalendlyWindow extends Window {
    Calendly?: {
        initInlineWidget: (options: {
            url: string;
            parentElement: HTMLElement;
            resize?: boolean;
            prefill?: {
                email?: string;
                name?: string;
                firstName?: string;
                lastName?: string;
            };
        }) => void;
    };
}

export function BookADemoContent({ email, name }: BookADemoContentProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const posthog = usePostHog();

    useEffect(() => {
        // Wait for Calendly script to load (loaded via Next.js Script component in parent)
        const initCalendly = () => {
            const calendlyWindow = window as CalendlyWindow;
            if (calendlyWindow.Calendly && containerRef.current) {
                calendlyWindow.Calendly.initInlineWidget({
                    url: CALENDLY_URL_EMBED,
                    parentElement: containerRef.current,
                    resize: true,
                    prefill: {
                        email: email || "",
                        name: name || ""
                    }
                });
            }
        };

        // Check if Calendly is already loaded
        if ((window as CalendlyWindow).Calendly) {
            initCalendly();
        } else {
            // Wait for script to load
            const checkCalendly = setInterval(() => {
                if ((window as CalendlyWindow).Calendly) {
                    clearInterval(checkCalendly);
                    initCalendly();
                }
            }, 100);

            // Cleanup interval after 10 seconds
            setTimeout(() => clearInterval(checkCalendly), 10000);
        }

        // Listen for Calendly events
        function isCalendlyEvent(e: MessageEvent) {
            return e.origin === "https://calendly.com" && e.data.event?.startsWith("calendly.");
        }

        function handleCalendlyEvent(e: MessageEvent) {
            if (isCalendlyEvent(e)) {
                // Check if user has scheduled an event
                if (e.data.event === "calendly.event_scheduled") {
                    captureEvent(posthog, PosthogEventName.SDK_DEMO_SCHEDULED, {
                        userEmail: email ?? "",
                        userName: name ?? ""
                    });
                }
            }
        }

        window.addEventListener("message", handleCalendlyEvent);

        return () => {
            window.removeEventListener("message", handleCalendlyEvent);
        };
    }, [email, name, posthog]);

    return (
        <div
            ref={containerRef}
            id="calendly-embed"
            className="border-0 outline outline-border rounded-xl overflow-hidden"
            style={{
                minWidth: "350px",
                minHeight: "400px", // keep min height to avoid jump on load
                maxHeight: "500px",
                height: "500px"
            }}
        />
    );
}
