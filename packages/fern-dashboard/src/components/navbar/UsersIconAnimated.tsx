import { cn } from "@/utils/utils";

export declare namespace UsersIcon {
    export interface Props {
        className?: string;
        strokeColor?: string;
    }
}

export function UsersIconAnimated({ className, strokeColor = "var(--green-1100)" }: UsersIcon.Props) {
    return (
        <svg
            className={cn("users", className)}
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path
                id="right-heady"
                d="M17.0304 7.1875C17.0304 8.39562 16.051 9.375 14.8429 9.375C13.6348 9.375 12.6554 8.39562 12.6554 7.1875C12.6554 5.97938 13.6348 5 14.8429 5C16.051 5 17.0304 5.97938 17.0304 7.1875Z"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-stroke-color transition"
            />
            <path
                id="right-body"
                d="M12.6546 16.0286C12.6551 15.999 12.6553 15.9693 12.6554 15.9396M12.6554 15.9396C13.3495 16.1417 14.0835 16.25 14.8428 16.25C16.0751 16.25 17.2408 15.9647 18.2774 15.4565C18.2793 15.4088 18.2803 15.3607 18.2803 15.3125C18.2803 13.414 16.7413 11.875 14.8428 11.875C13.6611 11.875 12.6187 12.4713 12 13.3793C12.4177 14.1382 12.6554 15.0101 12.6554 15.9375V15.9396Z"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-stroke-color transition"
            />
            <path
                id="left-head"
                d="M10.125 5.8125C10.125 7.3658 8.8658 8.625 7.3125 8.625C5.7592 8.625 4.5 7.3658 4.5 5.8125C4.5 4.2592 5.7592 3 7.3125 3C8.8658 3 10.125 4.2592 10.125 5.8125Z"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-stroke-color transition"
            />
            <path
                id="left-body"
                d="M2.00077 16.5286C2.00026 16.4983 2 16.4679 2 16.4375C2 13.5035 4.37849 11.125 7.3125 11.125C9.3191 11.125 11.0659 12.2375 11.9696 13.8793C12.3874 14.6382 12.625 15.5101 12.625 16.4375V16.4396C12.625 16.4693 12.6247 16.499 12.6242 16.5286C11.0728 17.4627 9.2554 18 7.3125 18C5.3696 18 3.5522 17.4627 2.00077 16.5286Z"
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-stroke-color transition"
            />
        </svg>
    );
}
