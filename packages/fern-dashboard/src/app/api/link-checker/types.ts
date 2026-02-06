export type LinkCheckEventType =
    | "sitemap_fetched"
    | "page_scraped"
    | "scrape_complete"
    | "scrape_batch_complete"
    | "links_check_started"
    | "link_check_progress"
    | "link_checked"
    | "link_blocked"
    | "batch_complete"
    | "complete"
    | "error";

export interface SitemapFetchedData {
    totalPages: number;
    sitemapUrl: string;
}

export interface PageScrapedData {
    pageUrl: string;
    linksFound: number;
    pageIndex: number;
    totalPages: number;
}

export interface LinksCheckStartedData {
    totalLinks: number;
}

export interface LinkProgressUpdateData {
    linksChecked: number;
    totalLinks: number;
}

export interface LinkCheckedData {
    url: string;
    statusCode: number | null;
    isInternal: boolean;
    sourcePages: string[];
    error?: string;
}

export interface BrokenLink {
    url: string;
    statusCode: number | null;
    error?: string;
    sourcePages: string[];
    isInternal: boolean;
}

export interface CompleteData {
    totalPages: number;
    totalLinks: number;
    brokenLinks: BrokenLink[];
    blockedLinks: BrokenLink[];
    workingLinks: number;
    skippedLinks: number;
    duration: number;
}

export interface ErrorData {
    message: string;
    code: string;
}

export interface ScrapeCompleteData {
    jobId: string;
    totalPages: number;
    totalLinks: number;
}

export interface BatchCompleteData {
    jobId: string;
    cursor: number;
    hasMore: boolean;
}

export interface ScrapeBatchCompleteData {
    scrapeJobId: string;
    pagesScraped: number;
    totalPages: number;
    hasMore: boolean;
}

export type LinkCheckProgressData =
    | SitemapFetchedData
    | PageScrapedData
    | ScrapeCompleteData
    | LinksCheckStartedData
    | LinkProgressUpdateData
    | LinkCheckedData
    | BatchCompleteData
    | ScrapeBatchCompleteData
    | CompleteData
    | ErrorData;

export interface LinkCheckProgress {
    type: LinkCheckEventType;
    data: LinkCheckProgressData;
    timestamp: string;
}

export type SendEventFn = (event: LinkCheckProgress) => void;
