export default function RootPage() {
    return (
        <div
            style={{
                fontFamily: "monospace",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                textAlign: "center"
            }}
        >
            <h1 style={{ marginBottom: "1rem" }}>Hey Fernie!</h1>
            <p>
                Use{" "}
                <code
                    style={{
                        backgroundColor: "#f0f0f0",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.25rem",
                        userSelect: "text",
                        cursor: "text"
                    }}
                >
                    /api/fern-docs/preview?host=
                </code>{" "}
                to point this domain at a host.
            </p>
        </div>
    );
}
