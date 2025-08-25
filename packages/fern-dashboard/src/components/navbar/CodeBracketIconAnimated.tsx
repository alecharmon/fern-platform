import React from "react";

import { cn } from "@/utils/utils";

export declare namespace CodeBracketIconAnimated {
  export interface Props {
    className?: string;
    strokeColor?: string;
  }
}

export function CodeBracketIconAnimated({
  className,
  strokeColor = "var(--green-1100)",
}: CodeBracketIconAnimated.Props) {
  return (
    <svg
      className={cn("code-bracket", className)}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        id="outer-right"
        d="M5.625 14.375L1.25 10L5.625 5.625"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-stroke-color transition"
      />
      <path
        id="outer-left"
        d="M14.375 5.625L18.75 10L14.375 14.375"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-stroke-color transition"
      />
      <path
        id="middle"
        d="M11.875 3.125L8.125 16.875"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-stroke-color transition"
      />
    </svg>
  );
}
