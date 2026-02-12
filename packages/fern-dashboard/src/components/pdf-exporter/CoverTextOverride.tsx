import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/utils/utils";

export interface CoverTextOverrideProps {
    value: string;
    onChange: (value: string) => void;
}

export function CoverTextOverride({ value, onChange }: CoverTextOverrideProps) {
    // Track hidden state independently so the toggle works even with empty custom text.
    // Always start as visible — the user opts into hiding via the toggle.
    const [hidden, setHidden] = useState(false);
    // Keep the custom text in a separate draft so we can restore it when un-hiding.
    const [customText, setCustomText] = useState(value);

    const handleToggle = useCallback(
        (checked: boolean) => {
            setHidden(checked);
            onChange(checked ? "" : customText);
        },
        [customText, onChange]
    );

    const handleTextChange = useCallback(
        (text: string) => {
            setCustomText(text);
            if (!hidden) {
                onChange(text);
            }
        },
        [hidden, onChange]
    );

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-1100">Hide this text</div>
                <Switch checked={hidden} onCheckedChange={handleToggle} />
            </div>
            <div className={cn("flex flex-col gap-2", hidden && "opacity-60")}>
                <Label className="text-sm font-medium text-gray-1100">Custom text</Label>
                <Input
                    disabled={hidden}
                    value={hidden ? customText : value}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="e.g. API Reference"
                />
            </div>
        </div>
    );
}
