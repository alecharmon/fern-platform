"use client";

import { useEffect, useState } from "react";

import { cn } from "@fern-docs/components";

import { AutoResizingInput } from "@/components/input/AutoResizingInput";
import { useEditingDisabled } from "@/hooks/useEditingDisabled";
import { useMdxState } from "@/providers/MdxStateContext";

export declare namespace PageSubtitle {
  export interface Props {
    className?: string;
    filename: string;
    initialText?: string;
  }
}

export default function PageSubtitle({
  className,
  filename,
  initialText,
}: PageSubtitle.Props) {
  const [text, setText] = useState(initialText);
  const isEditingDisabled = useEditingDisabled();

  const { stageChanges, frontmatterData } = useMdxState();

  // Watch for frontmatter changes from dev panel and update text accordingly
  useEffect(() => {
    const currentFrontmatter = frontmatterData[filename];
    if (currentFrontmatter && "subtitle" in currentFrontmatter) {
      // Subtitle field exists in frontmatter
      const newSubtitle = currentFrontmatter.subtitle
        ? String(currentFrontmatter.subtitle)
        : "";
      if (newSubtitle !== text) {
        setText(newSubtitle);
      }
    } else if (text) {
      // Subtitle field was deleted from frontmatter, clear the input
      setText("");
    }
  }, [frontmatterData, filename, text]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextText = e.target.value;
    setText(nextText);

    // If the text is empty, we want to remove the subtitle field entirely
    // We can do this by passing undefined, which will be filtered out when converting back to MDX
    if (nextText.trim() === "") {
      stageChanges(filename, {
        frontmatter: { subtitle: undefined },
      });
    } else {
      stageChanges(filename, {
        frontmatter: { subtitle: nextText },
      });
    }
  }

  return (
    <div className={cn("flex", className)}>
      <AutoResizingInput
        className="mx-5 text-base"
        name="subtitle"
        onChange={onChange}
        disabled={isEditingDisabled}
        placeholder="Add a subtitle"
        value={text}
      />
    </div>
  );
}
