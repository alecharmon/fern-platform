import "server-only";

import { Separator } from "@fern-docs/components/Separator";
import React from "react";

import { MdxServerComponent } from "@/mdx/components/server-component";
import type { MdxSerializer } from "@/server/mdx-serializer";

import { BottomNavigationClient } from "./bottom-nav-client";

export function BottomNavigation({
    neighbors,
    serialize,
    lang,
    footerNavStyle = "default"
}: {
    serialize: MdxSerializer;
    lang: string;
    footerNavStyle?: "default" | "minimal";
    neighbors: {
        prev?: {
            title: string;
            href: string;
            excerpt?: string;
        };
        next?: {
            title: string;
            href: string;
            excerpt?: string;
        };
    };
}) {
    if (neighbors.prev == null && neighbors.next == null) {
        return <Separator />;
    }

    const prevTitle = neighbors.prev && (
        <React.Suspense fallback={neighbors.prev.title}>
            <MdxServerComponent serialize={serialize} mdx={neighbors.prev.title} />
        </React.Suspense>
    );

    const prevExcerpt = neighbors.prev && (
        <React.Suspense fallback={neighbors.prev.excerpt}>
            <MdxServerComponent serialize={serialize} mdx={neighbors.prev.excerpt} />
        </React.Suspense>
    );

    const nextTitle = neighbors.next && (
        <React.Suspense fallback={neighbors.next.title}>
            <MdxServerComponent serialize={serialize} mdx={neighbors.next.title} />
        </React.Suspense>
    );

    const nextExcerpt = neighbors.next && (
        <React.Suspense fallback={neighbors.next.excerpt}>
            <MdxServerComponent serialize={serialize} mdx={neighbors.next.excerpt} />
        </React.Suspense>
    );

    return (
        <BottomNavigationClient
            prev={
                neighbors.prev
                    ? {
                          title: prevTitle,
                          excerpt: prevExcerpt,
                          href: neighbors.prev.href
                      }
                    : undefined
            }
            next={
                neighbors.next
                    ? {
                          title: nextTitle,
                          excerpt: nextExcerpt,
                          href: neighbors.next.href
                      }
                    : undefined
            }
            lang={lang}
            footerNavStyle={footerNavStyle}
        />
    );
}
