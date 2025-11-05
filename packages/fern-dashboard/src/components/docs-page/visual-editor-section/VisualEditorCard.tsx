import Card from "../../ui/card";
import { VisualEditorHeader } from "./VisualEditorHeader";

export function VisualEditorCard({
    children,
    rightContent
}: {
    children: React.ReactNode;
    rightContent?: React.ReactNode;
}) {
    return (
        <Card className="relative flex flex-col gap-4">
            <VisualEditorHeader rightContent={rightContent} />
            {children}
        </Card>
    );
}
