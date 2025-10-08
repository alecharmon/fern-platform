import { HiddenSidebar, SetLayout } from "../state/layout";

interface CustomLayoutProps {
    children?: React.ReactNode;
    footer?: React.ReactNode;
}

// sidebar is always hidden on custom layouts
export function CustomLayout({ children, footer }: CustomLayoutProps) {
    return (
        <div className="width-before-scroll-bar w-screen">
            <SetLayout value="custom" />
            <HiddenSidebar />
            {children}
            {footer}
        </div>
    );
}
