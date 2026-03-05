/**
 * ISR Revalidation Configuration
 *
 * All sibling route segments under [roles]/ must use the same `revalidate` value
 * (Turbopack requirement). The current value is 60 seconds.
 *
 * Next.js requires `revalidate` to be a literal value in each route file —
 * it cannot be an imported constant. So each sibling file has:
 *   export const revalidate = 60;
 *
 * If you need to change the interval, update the literal in ALL sibling files:
 *   - [slug]/page.tsx
 *   - not-found.tsx
 *   - @announcement/[slug]/page.tsx
 *   - @explorer/[slug]/page.tsx
 *   - @explorer/@sidebar/[slug]/page.tsx
 *   - @headertabs/[slug]/page.tsx
 *   - @languageSelect/[slug]/page.tsx
 *   - @logo/[slug]/page.tsx
 *   - @productSelect/[slug]/page.tsx
 *   - @sidebar/[slug]/page.tsx
 *   - @versionSelect/[slug]/page.tsx
 *
 * Using ISR with a short window (instead of `revalidate = false`) ensures that
 * error responses (404, 500) are only cached briefly and will be re-checked
 * on the next revalidation, rather than being cached indefinitely.
 * Successful pages are served instantly from cache (stale-while-revalidate)
 * so there is no user-facing latency impact.
 */
