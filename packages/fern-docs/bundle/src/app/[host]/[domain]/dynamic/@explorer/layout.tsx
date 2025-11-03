import { InterceptedPlaygroundCloseButton } from "@/components/playground/PlaygroundCloseButton";
import { PlaygroundDrawer } from "@/components/playground/PlaygroundDrawer";
import { HorizontalSplitPane } from "@/components/playground/VerticalSplitPane";

export default async function ExplorerLayout({
    children,
    sidebar
}: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
}) {
    return (
        <PlaygroundDrawer>
            <InterceptedPlaygroundCloseButton />
            <HorizontalSplitPane
                mode="pixel"
                className="w-full flex-1 overflow-y-auto"
                leftClassName="border-border-default border-r hidden lg:block"
            >
                {sidebar}
                {children}
            </HorizontalSplitPane>
        </PlaygroundDrawer>
    );
}
