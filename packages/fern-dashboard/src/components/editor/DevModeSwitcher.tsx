import { Code2 } from "lucide-react";
import { useCallback } from "react";

import { Switch } from "@/components/ui/switch";
import { useDevMode } from "@/providers/DevModeProvider";
import { useThemingPanel } from "@/providers/ThemingPanelProvider";
import { cn } from "@/utils/utils";

export const DevModeSwitcher = () => {
    const { panelOpen, setPanelOpen, isDevModeDisabled } = useDevMode();
    const { setThemingPanelOpen } = useThemingPanel();

    const handleCheckedChange = useCallback(
        (checked: boolean) => {
            setPanelOpen(checked);
            if (checked) {
                setThemingPanelOpen(false);
            }
        },
        [setPanelOpen, setThemingPanelOpen]
    );

    return (
        <Switch
            checked={panelOpen}
            onCheckedChange={handleCheckedChange}
            disabled={isDevModeDisabled}
            thumbContent={
                <div className="flex items-center justify-center">
                    <Code2
                        className={cn(
                            "size-4",
                            isDevModeDisabled
                                ? "text-muted-foreground/50"
                                : panelOpen
                                  ? "text-primary"
                                  : "text-muted-foreground"
                        )}
                    />
                </div>
            }
        />
    );
};
