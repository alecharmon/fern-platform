export const Filter = ({ fill = "currentColor", className }: { fill?: string; className?: string }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill={fill}
            className={className}
        >
            <path
                d="M1.3335 3.33331H14.6668"
                stroke="currentColor"
                strokeWidth="1.33333"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={fill}
            />
            <path
                d="M4 8H12"
                stroke="currentColor"
                strokeWidth="1.33333"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={fill}
            />
            <path
                d="M6 12.6667H10"
                stroke="currentColor"
                strokeWidth="1.33333"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={fill}
            />
        </svg>
    );
};
