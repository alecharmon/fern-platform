import Script from "next/script";

export interface JsConfig {
    remote:
        | {
              url: string;
              strategy: "beforeInteractive" | "afterInteractive" | "lazyOnload" | undefined;
              integrity?: string; // Pre-computed SRI hash for external scripts (in FDR)
          }[]
        | undefined;
    inline: string[] | undefined;
}

export function JavascriptProvider({ config }: { config: JsConfig }) {
    return (
        <>
            {config.inline?.map((inline, idx) => (
                <Script key={`inline-script-${idx}`} id={`inline-script-${idx}`} defer>
                    {inline}
                </Script>
            ))}
            {/* External scripts are given an integrity hash in FDR, but only if they are on newer versions.
            In order for hashes to work, the crossOrigin must be set to anonymous. If there's no integrity hash,
            then we do NOT want to add crossOrigin to maintain backward compatibility. */}
            {config.remote?.map((remote) => (
                <Script
                    key={remote.url}
                    src={remote.url}
                    strategy={remote.strategy}
                    type="module"
                    crossOrigin={remote.integrity ? "anonymous" : undefined}
                    integrity={remote.integrity}
                    defer
                />
            ))}
        </>
    );
}
