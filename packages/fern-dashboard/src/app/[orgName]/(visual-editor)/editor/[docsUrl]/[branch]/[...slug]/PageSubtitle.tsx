"use client";

import { useEffect, useState } from "react";

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

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    <div className={["flex", className].join(" ")}>
      <input
        className="mx-5 flex-1 text-base focus:outline-none"
        name="subtitle"
        onChange={onChange}
        placeholder="Add a subtitle"
        value={text}
      />
    </div>
  );
}
