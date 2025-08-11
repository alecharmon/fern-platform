"use client";

import { useEffect, useState } from "react";

import { AutoResizingInput } from "@/components/input/AutoResizingInput";
import { useMdxState } from "@/providers/MdxStateContext";

export declare namespace PageTitle {
  export interface Props {
    className?: string;
    filename: string;
    initialText?: string;
  }
}

export default function PageTitle({
  className,
  filename,
  initialText,
}: PageTitle.Props) {
  const [text, setText] = useState(initialText ?? "");

  const { stageChanges, frontmatterData } = useMdxState();

  // Watch for frontmatter changes from dev panel and update text accordingly
  useEffect(() => {
    const currentFrontmatter = frontmatterData[filename];
    if (currentFrontmatter?.title) {
      const newTitle = String(currentFrontmatter.title);
      if (newTitle !== text) {
        setText(newTitle);
      }
    } else if (text) {
      setText("");
    }
  }, [frontmatterData, filename, text]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextText = e.target.value;
    setText(nextText);
    stageChanges(filename, {
      frontmatter: { title: nextText },
    });
  }

  return (
    <div className={["flex", className].join(" ")}>
      <h1 className="fern-page-heading mb-3 h-fit w-full font-extrabold">
        <AutoResizingInput
          className="mx-5 font-extrabold"
          name="title"
          onChange={onChange}
          placeholder="Add a title"
          value={text}
        />
      </h1>
    </div>
  );
}
