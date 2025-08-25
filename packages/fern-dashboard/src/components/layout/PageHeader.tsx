export declare namespace PageHeader {
  export interface Props {
    title: React.JSX.Element | string;
    titleRightContent?: React.JSX.Element;
    subtitle?: string;
    rightContent?: React.JSX.Element;
    farRightContent?: React.JSX.Element;
  }
}

export function PageHeader({
  title,
  titleRightContent,
  subtitle,
  rightContent,
  farRightContent,
}: PageHeader.Props) {
  return (
    <div className="mb-5 flex w-full flex-wrap justify-between gap-2">
      <div className="flex gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold md:text-2xl">{title}</div>
            {titleRightContent}
          </div>
          {subtitle != null && <div className="text-gray-900">{subtitle}</div>}
        </div>
        {rightContent}
      </div>
      {farRightContent}
    </div>
  );
}
