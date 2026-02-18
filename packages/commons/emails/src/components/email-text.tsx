import { Text } from "@react-email/components";

interface EmailTextProps {
    children: React.ReactNode;
    className?: string;
}

export function EmailText({ children, className }: EmailTextProps): React.JSX.Element {
    return (
        <Text className={`m-0 mb-4 font-sans text-[15px] leading-relaxed text-email-text ${className ?? ""}`}>
            {children}
        </Text>
    );
}
