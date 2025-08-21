import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export function WarningNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-yellow-800 bg-yellow-300 p-2 px-3 text-yellow-800">
      <ExclamationTriangleIcon className="size-4" />
      <p className="text-sm">{children}</p>
    </div>
  );
}
