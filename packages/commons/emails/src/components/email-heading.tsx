import { Heading } from "@react-email/components";

interface EmailHeadingProps {
    children: React.ReactNode;
}

export function EmailHeading({ children }: EmailHeadingProps): React.JSX.Element {
    return <Heading className="m-0 mb-6 font-sans text-2xl font-medium leading-tight text-black">{children}</Heading>;
}
