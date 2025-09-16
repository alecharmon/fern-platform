import { AnimatedSidepanelContainer } from "./AnimatedSidepanelContainer";
import { Footer } from "./footer/Footer";

export declare namespace AppLayout {
  export interface Props {
    children: React.JSX.Element;
    sidepanel: React.ReactNode;
    navbar: React.ReactNode;
    header: React.ReactNode;
  }
}

export async function AppLayout({
  children,
  sidepanel,
  navbar,
  header,
}: AppLayout.Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {header}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row-reverse">
        <div className="relative flex flex-1 overflow-hidden">
          <div className="flex min-w-0 flex-1 md:pr-2">
            <div className="flex flex-1 justify-center overflow-y-auto bg-[var(--gray-100)] px-6 pt-8 md:rounded-t-2xl lg:px-12 lg:pt-12">
              <div className="flex min-w-0 max-w-[1200px] flex-1 flex-col">
                <div className="flex flex-1">{children}</div>
                <div className="pb-24 pt-12 md:py-12">
                  <Footer />
                </div>
              </div>
            </div>
          </div>
          <AnimatedSidepanelContainer>{sidepanel}</AnimatedSidepanelContainer>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-2 pb-2 md:relative md:w-fit">
          {navbar}
        </div>
      </div>
    </div>
  );
}
