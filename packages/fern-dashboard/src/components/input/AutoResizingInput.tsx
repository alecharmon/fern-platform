import { useEffect, useRef } from "react";

import { cn } from "@/utils/utils";

export function AutoResizingInput({
  className,
  value,
  onChange,
  placeholder,
  name,
  ...props
}: React.ComponentProps<"textarea">) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className={cn(
        "w-full flex-1 resize-none overflow-hidden focus:outline-none",
        className
      )}
      name={name}
      onChange={onChange}
      placeholder={placeholder}
      value={value}
      rows={1}
      {...props}
    />
  );
}
