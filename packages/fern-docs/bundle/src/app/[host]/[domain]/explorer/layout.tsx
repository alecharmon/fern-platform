import "server-only";

import { PlaygroundCloseButton } from "@/components/playground/PlaygroundCloseButton";
import { PlaygroundKeyboardTrigger } from "@/components/playground/PlaygroundKeyboardTrigger";
import { HorizontalSplitPane } from "@/components/playground/VerticalSplitPane";

export default async function Layout({ children, sidebar }: { children: React.ReactNode; sidebar: React.ReactNode }) {
    return (
        <main className="fixed inset-0">
            <PlaygroundKeyboardTrigger />
            <PlaygroundCloseButton />
            <HorizontalSplitPane
                mode="pixel"
                className="size-full"
                leftClassName="border-border-default border-r hidden lg:block"
            >
                {sidebar}
                {children}
            </HorizontalSplitPane>
        </main>
    );
}
