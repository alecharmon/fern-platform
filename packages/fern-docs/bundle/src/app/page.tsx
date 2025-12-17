/*eslint i18next/no-literal-string: off*/
export default function RootPage() {
    console.error("Error: Host not found. Use /api/fern-docs/preview?host= to point this domain at a host.");

    return (
        <div
            style={{
                fontFamily: "monospace",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                textAlign: "center",
                padding: "2rem"
            }}
        >
            <h1 style={{ marginBottom: "1rem", color: "#dc2626" }}>Error: Host Not Found</h1>
            <p style={{ maxWidth: "600px" }}>The requested host could not be found. Please restart the server.</p>
        </div>
    );
}
