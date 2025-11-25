import { useEffect, useState } from "react";

const FLAG_KEY = "fai-chat-endpoint-migration-enabled";

export function useIsChatMigrationEnabled(): boolean {
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        let mounted = true;

        void import("posthog-js").then(({ default: posthog }) => {
            const update = () => {
                const enabled = posthog.isFeatureEnabled?.(FLAG_KEY) ?? false;
                if (mounted) {
                    setIsEnabled(Boolean(enabled));
                }
            };

            update();
            posthog.onFeatureFlags?.(update);
        });

        return () => {
            mounted = false;
        };
    }, []);

    return isEnabled;
}
