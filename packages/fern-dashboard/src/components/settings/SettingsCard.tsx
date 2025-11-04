export function SettingsCard({
    title,
    description,
    button
}: {
    title: string;
    description: string;
    button: React.ReactNode;
}) {
    return (
        <div className="border-border mx-auto flex w-full max-w-[750px] flex-1 flex-col rounded-xl border bg-gray-100 p-4">
            <div className="flex flex-col gap-1">
                <div className="font-bold">{title}</div>
                <div className="text-muted-foreground">{description}</div>
            </div>
            <div className="mt-5 flex justify-center md:justify-end">{button}</div>
        </div>
    );
}
