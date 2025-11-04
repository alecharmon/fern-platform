export function DocsSiteAttribute({ name, children }: { name: string; children: React.ReactNode }) {
    return (
        <div className="flex w-fit flex-col gap-2">
            <p>{name}</p>
            {children}
        </div>
    );
}
