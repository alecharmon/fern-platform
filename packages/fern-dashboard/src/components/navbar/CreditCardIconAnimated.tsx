import React from "react";

import { cn } from "@/utils/utils";

export declare namespace CreditCardIconAnimated {
  export interface Props {
    className?: string;
    strokeColor?: string;
  }
}

export function CreditCardIconAnimated({
  className,
  strokeColor = "var(--green-1100)",
}: CreditCardIconAnimated.Props) {
  return (
    <svg
      className={cn("credit-card", className)}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        id="card"
        d="M1.875 5.625C1.875 4.58947 2.71447 3.75 3.75 3.75H16.25C17.2855 3.75 18.125 4.58947 18.125 5.625V14.375C18.125 15.4105 17.2855 16.25 16.25 16.25H3.75C2.71447 16.25 1.875 15.4105 1.875 14.375V5.625Z"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-stroke-color transition"
      />
      <path
        id="details"
        d="M4.375 11.875H9.375M4.375 13.75H6.875"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-stroke-color transition"
      />
      <path
        id="stripe"
        d="M1.875 6.875H18.125M1.875 7.5H18.125"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-stroke-color transition"
      />
    </svg>
  );
}
