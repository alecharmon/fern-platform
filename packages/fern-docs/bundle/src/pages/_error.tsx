import { getDocsDomainNode, getHostNode } from "@fern-api/docs-server/xfernhost/node";
import { parseServerSidePathname } from "@fern-docs/components/hooks/use-current-pathname";

import { isEmpty } from "es-toolkit/compat";
import type { GetServerSideProps, NextApiRequest } from "next";
import Error from "next/error";

export const getServerSideProps: GetServerSideProps = async (context) => {
    if (isEmpty(context.query.error) && context.req.url) {
        console.debug("resolvedUrl", context.resolvedUrl);

        const host = getHostNode(context.req);
        const domain = getDocsDomainNode(context.req as NextApiRequest);

        const url = new URL(context.resolvedUrl, "https://example.com");
        url.pathname = parseServerSidePathname(url.pathname);

        const pathname = url.pathname;
        const shouldPrefix = host !== domain && !(pathname === `/${domain}` || pathname.startsWith(`/${domain}/`));
        const finalPath = shouldPrefix ? `/${domain}${pathname}` : pathname;

        const searchParams = new URLSearchParams(url.search);
        searchParams.set("error", "true");
        const search = searchParams.toString() ? `?${searchParams.toString()}` : "";

        const destination = `${finalPath}${search}`;
        console.debug("destination", destination);

        return {
            redirect: {
                destination,
                permanent: false
            }
        };
    }
    return { props: { errorCode: 500 } };
};

export default function Page({ errorCode }: { errorCode: number }) {
    return <Error statusCode={errorCode} />;
}
