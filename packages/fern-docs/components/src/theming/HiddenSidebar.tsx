"use client";

export function HiddenSidebar() {
    return (
        <style>{`
        #fern-toc,
        #fern-sidebar[data-state="sticky"],
        #fern-sidebar[data-state="fixed"],
        #fern-sidebar-spacer {
          visibility: hidden;
          width: 0;
          overflow: hidden;
          display: none;
        }
      `}</style>
    );
}
