import { BetaBadge } from "../BetaBadge";

export function VisualEditorHeader() {
    return (
        <div className="flex items-center gap-2 text-lg font-semibold">
            Fern Editor
            <BetaBadge />
        </div>
    );
}
