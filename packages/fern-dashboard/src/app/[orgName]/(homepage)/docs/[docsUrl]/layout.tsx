import { Suspense } from "react";

export const experimental_ppr = true;

export default async function DocsLayout({
  navbar,
  children,
  header,
}: Readonly<{
  navbar: React.JSX.Element;
  children: React.JSX.Element;
  header: React.JSX.Element;
}>) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {header}
      <div className="flex flex-col gap-4">
        <Suspense fallback={null}>{navbar}</Suspense>
        <div className="flex">{children}</div>
      </div>
    </div>
  );
}
