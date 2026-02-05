import Script from "next/script";
import { enrichRemoteScriptsWithIntegrity } from "../util/sri";

export interface JsConfig {
    remote:
        | {
              url: string;
              strategy: "beforeInteractive" | "afterInteractive" | "lazyOnload" | undefined;
              integrity?: string; // SRI hash for external scripts (pre-computed in FDR or computed at render time)
          }[]
        | undefined;
    inline: string[] | undefined;
}

export async function JavascriptProvider({ config }: { config: JsConfig }) {
    // Enrich remote scripts with integrity hashes if not already present
    // This computation happens server-side during SSR/build and is cached
    const enrichedRemote = await enrichRemoteScriptsWithIntegrity(config.remote);

    return (
        <>
            {config.inline?.map((inline, idx) => (
                <Script key={`inline-script-${idx}`} id={`inline-script-${idx}`} defer>
                    {inline}
                </Script>
            ))}
            {/* External scripts are given an integrity hash either from FDR or computed at render time.
            In order for hashes to work, the crossOrigin must be set to anonymous. If there's no integrity hash,
            then we do NOT want to add crossOrigin to maintain backward compatibility. */}
            {enrichedRemote?.map((remote) => (
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
