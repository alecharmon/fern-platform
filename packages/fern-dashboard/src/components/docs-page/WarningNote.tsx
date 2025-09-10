import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export function WarningNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-800 bg-yellow-300 p-2 px-3 text-yellow-800">
      <ExclamationTriangleIcon className="size-6 flex-shrink-0" />
      <p className="self-center text-sm">{children}</p>
    </div>
  );
}
