import { Button } from "@react-email/components";

interface EmailButtonProps {
    href: string;
    children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps): React.JSX.Element {
    return (
        <Button
            className="inline-block rounded-md bg-fern-green px-7 py-3.5 font-sans text-[15px] font-semibold text-white no-underline"
            href={href}
        >
            {children}
        </Button>
    );
}
