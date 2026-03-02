/**
 * Decorative header illustration for the docs site upsell modal.
 * Renders a miniature wireframe of a docs site over a green gradient,
 * matching the Figma design at node 5861:20011.
 */
export function DocsSiteHeaderIllustration() {
    return (
        <div className="relative h-[147px] w-full overflow-hidden border-b border-[#e0e1e6] dark:border-[#2e2f35]">
            {/* Green gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-100/60 via-green-50/40 to-white dark:from-green-900/25 dark:via-green-950/15 dark:to-transparent" />
            <div className="absolute -left-10 -top-10 h-[200px] w-[300px] rounded-full bg-green-200/30 blur-3xl dark:bg-green-700/20" />
            <div className="absolute -right-10 top-0 h-[150px] w-[200px] rounded-full bg-green-100/40 blur-2xl dark:bg-green-800/20" />
            <div className="absolute bottom-0 left-1/4 h-[100px] w-[250px] rounded-full bg-green-200/20 blur-3xl dark:bg-green-700/10" />

            {/* Decorative green lines radiating from center */}
            <svg
                className="absolute left-1/2 top-[27px] -translate-x-1/2"
                width="331"
                height="175"
                viewBox="0 0 331 175"
                fill="none"
                aria-hidden="true"
            >
                {/* Horizontal line right */}
                <line x1="166" y1="0" x2="274" y2="0" stroke="#86efac" strokeWidth="0.5" opacity="0.6" />
                {/* Curved line top-right */}
                <path d="M166 0 Q200 0 301 0" stroke="#86efac" strokeWidth="0.5" opacity="0.4" />
                {/* Vertical line left */}
                <line x1="0" y1="0" x2="0" y2="96" stroke="#86efac" strokeWidth="0.5" opacity="0.4" />
                {/* Corner line top-left */}
                <path d="M0 0 Q0 0 0 53" stroke="#86efac" strokeWidth="0.5" opacity="0.3" />
            </svg>

            {/* Progressive fade to background at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-white via-white/80 to-transparent dark:from-background dark:via-background/80" />

            {/* Miniature docs site wireframe card */}
            <div className="absolute left-1/2 top-[27px] -translate-x-1/2">
                <div className="w-[330px] overflow-hidden rounded-[5px] border border-[#e0e1e6] bg-white shadow-[0px_0px_36px_0px_rgba(0,0,0,0.04)] dark:border-[#2e2f35] dark:bg-[#1e1f24]">
                    {/* Top navigation bar */}
                    <div className="flex h-[14px] items-center justify-between border-b border-[#e0e1e6] px-2 dark:border-[#2e2f35]">
                        <div className="h-[1.2px] w-[144px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                        <div className="flex items-center gap-[3px]">
                            <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            <div className="flex h-[11px] items-center rounded-[3px] border border-[#e0e1e6] px-1 dark:border-[#2e2f35]">
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                        </div>
                    </div>

                    {/* Tab bar */}
                    <div className="flex h-[14px] items-center gap-0 border-b border-[#e0e1e6] px-1.5 dark:border-[#2e2f35]">
                        <div className="flex h-full items-center px-1">
                            <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                        </div>
                        <div className="flex h-full items-center px-1">
                            <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                        </div>
                        <div className="flex h-full items-center border-b border-[#e0e1e6] px-1 dark:border-[#3e3f46]">
                            <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                        </div>
                        <div className="flex h-full items-center px-1">
                            <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                        </div>
                    </div>

                    {/* Content area: sidebar + main */}
                    <div className="flex h-[145px]">
                        {/* Sidebar */}
                        <div className="flex w-[78px] flex-col gap-[4px] border-r border-[#e0e1e6] px-1 py-1 dark:border-[#2e2f35]">
                            <div className="flex h-[12px] items-center px-1">
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                            <div className="flex h-[12px] items-center gap-[7px] rounded-[3px] border border-[#e0e1e6] px-2 dark:border-[#2e2f35]">
                                <div className="size-[7px] rounded-sm bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                            <div className="flex h-[12px] items-center gap-[7px] px-2">
                                <div className="size-[7px] rounded-full bg-[#e0e1e6] opacity-60 dark:bg-[#3e3f46]" />
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                            <div className="flex h-[12px] items-center gap-[7px] px-2">
                                <div className="size-[7px] rounded-full bg-[#e0e1e6] opacity-60 dark:bg-[#3e3f46]" />
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                            <div className="flex h-[12px] items-center gap-[7px] px-2">
                                <div className="size-[7px] rounded-full bg-[#e0e1e6] opacity-60 dark:bg-[#3e3f46]" />
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                            {/* Separator */}
                            <div className="my-0.5 flex h-[12px] items-center px-1">
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                            <div className="flex h-[12px] items-center gap-1 px-1">
                                <div className="h-[1.2px] w-[14px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                        </div>

                        {/* Main content area */}
                        <div className="flex flex-1 flex-col gap-[10px] p-3">
                            <span className="text-[9px] tracking-[-0.17px] text-[#b9bbc6] dark:text-[#62636c]">
                                Welcome to your documentation
                            </span>
                            <div className="h-[60px] w-[179px] rounded-sm bg-[#e0e1e6]/20 dark:bg-[#3e3f46]/20" />
                            <div className="flex flex-col gap-[5px]">
                                <div className="h-[1.2px] w-[78px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                                <div className="h-[1.2px] w-[132px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                                <div className="h-[1.2px] w-[74px] rounded-full bg-[#e0e1e6] dark:bg-[#3e3f46]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
