import { Prose } from "../mdx/prose";
import { SetLayout } from "../state/layout";

interface GuideLayoutProps {
  header?: React.ReactNode;
  toc?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function GuideLayout({
  header,
  toc,
  children,
  footer,
}: GuideLayoutProps) {
  return (
    <>
      <SetLayout value="guide" />
      {toc}
      <div className="fern-layout-guide transition-all duration-500 ease-out">
        <article className="w-content-width max-w-full">
          {header}
          <Prose className="prose-h1:mt-[1.5em] first:prose-h1:mt-0 max-w-full">
            {children}
          </Prose>
          {footer}
        </article>
      </div>
    </>
  );
}
