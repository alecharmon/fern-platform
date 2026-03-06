import { TEMPLATE_PAGE_INDEX_PLACEHOLDER, TEMPLATE_TOTAL_PAGES_PLACEHOLDER } from "@fern-api/docs-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TEMPLATE_PLACEHOLDERS = [TEMPLATE_PAGE_INDEX_PLACEHOLDER, TEMPLATE_TOTAL_PAGES_PLACEHOLDER] as const;

export interface TemplateOverrideProps {
    value: string | undefined;
    onChange: (value: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export function TemplateOverride({ value, onChange, onFocus, onBlur }: TemplateOverrideProps) {
    const insertPlaceholder = (placeholder: (typeof TEMPLATE_PLACEHOLDERS)[number]) => {
        const current = value ?? "";
        const next = current.length === 0 ? placeholder : `${current}${current.endsWith(" ") ? "" : " "}${placeholder}`;
        onChange(next);
    };

    return (
        <div
            className="flex flex-col gap-3"
            onFocus={onFocus}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    onBlur?.();
                }
            }}
        >
            <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium text-gray-1100">Template</Label>
                <Input
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="e.g. Page {pageIndex} of {totalPages}"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-muted-foreground">Insert:</div>
                    {TEMPLATE_PLACEHOLDERS.map((p) => (
                        <Button key={p} type="button" variant="outline" size="xs" onClick={() => insertPlaceholder(p)}>
                            <code className="text-xs">{p}</code>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
