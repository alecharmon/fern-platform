"use client";

export declare namespace GenerateTokenButton {
    export interface Props {
        onClick: () => void;
        isLoading: boolean;
    }
}

export function GenerateTokenButton({ onClick, isLoading }: GenerateTokenButton.Props) {
    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
            {isLoading ? "Generating..." : "Generate Tokens"}
        </button>
    );
}
