const ICON_URL = new URL("./empty-state-icon.svg", import.meta.url).toString();

export function EmptyStateIcon() {
    return <img src={ICON_URL} alt="" width={126} height={80} />;
}
