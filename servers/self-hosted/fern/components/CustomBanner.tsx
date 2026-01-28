/**
 * A custom React component for testing custom components support in self-hosted docs.
 * This component renders a styled banner with customizable text and type.
 */

interface CustomBannerProps {
    title: string;
    message?: string;
    type?: "info" | "success" | "warning" | "error";
}

export const CustomBanner = ({ title, message, type = "info" }: CustomBannerProps) => {
    const colors = {
        info: {
            bg: "#e3f2fd",
            border: "#2196f3",
            text: "#1565c0"
        },
        success: {
            bg: "#e8f5e9",
            border: "#4caf50",
            text: "#2e7d32"
        },
        warning: {
            bg: "#fff3e0",
            border: "#ff9800",
            text: "#e65100"
        },
        error: {
            bg: "#ffebee",
            border: "#f44336",
            text: "#c62828"
        }
    };

    const color = colors[type];

    return (
        <div
            data-testid="custom-banner"
            data-banner-type={type}
            style={{
                backgroundColor: color.bg,
                border: `2px solid ${color.border}`,
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px"
            }}
        >
            <h3
                style={{
                    color: color.text,
                    margin: "0 0 8px 0",
                    fontSize: "18px",
                    fontWeight: 600
                }}
            >
                {title}
            </h3>
            {message && (
                <p
                    style={{
                        color: color.text,
                        margin: 0,
                        fontSize: "14px"
                    }}
                >
                    {message}
                </p>
            )}
        </div>
    );
};

export default CustomBanner;
