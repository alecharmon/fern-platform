import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { DataTable } from "./data-table";

// ------------------------------------------------------------------
// Sample data type
// ------------------------------------------------------------------

interface UsageEntry {
    id: string;
    description: string;
    docsSite: string;
    type: string;
    date: string;
    creditsUsed: number;
}

// ------------------------------------------------------------------
// Column definitions
// ------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
    "Ask Fern • Slack": "bg-primary/60",
    "Ask Fern • Docs": "bg-blue-600/60",
    "AI Search": "bg-purple-600/60",
    "Doc Generation": "bg-yellow-600/60"
};

const columns: ColumnDef<UsageEntry, unknown>[] = [
    {
        accessorKey: "description",
        header: "Description",
        enableColumnFilter: false
    },
    {
        accessorKey: "docsSite",
        header: "Docs site",
        enableColumnFilter: true,
        meta: { width: 180 }
    },
    {
        accessorKey: "type",
        header: "Type",
        enableColumnFilter: true,
        meta: { width: 180 },
        cell: ({ row }) => {
            const type = row.getValue<string>("type");
            const color = TYPE_COLORS[type] ?? "bg-gray-400";
            return (
                <span className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded ${color}`} />
                    <span className="truncate">{type}</span>
                </span>
            );
        }
    },
    {
        accessorKey: "date",
        header: "Date",
        meta: { width: 160 },
        enableColumnFilter: false
    },
    {
        accessorKey: "creditsUsed",
        header: "Credits used",
        meta: { width: 120 },
        enableColumnFilter: false
    },
    {
        id: "actions",
        header: "",
        enableSorting: false,
        enableColumnFilter: false,
        meta: { width: 80 },
        cell: () => <span className="text-primary whitespace-nowrap">View →</span>
    }
];

// ------------------------------------------------------------------
// Generate sample data (150 rows — enough for 15 pages at pageSize=10)
// ------------------------------------------------------------------

const SITES = [
    "buildwithfern.com/learn",
    "docs.buildwithfern.com",
    "vellum.docs.buildwithfern.com",
    "humanloop.docs.buildwithfern.com",
    "cohere.docs.buildwithfern.com"
];

const TYPES = Object.keys(TYPE_COLORS);

const DESCRIPTIONS = [
    "How do I put it inside of an existing Next.js project",
    "What authentication methods are supported",
    "How to configure custom domains",
    "Setting up webhooks for real-time updates",
    "API rate limiting best practices",
    "How to migrate from v1 to v2",
    "Understanding pagination in the REST API",
    "Configuring CORS for browser clients",
    "How to use the SDK with TypeScript",
    "Deploying to production checklist",
    "Debugging 404 errors on custom domains",
    "How to add search to my docs",
    "Integrating with GitHub Actions",
    "Setting up SSO for my organization",
    "How to customize the sidebar navigation"
];

function generateData(count: number): UsageEntry[] {
    const data: UsageEntry[] = [];
    const startDate = new Date(2026, 1, 1);

    for (let i = 0; i < count; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + Math.floor(i / 4));
        data.push({
            id: `entry-${i}`,
            description: DESCRIPTIONS[i % DESCRIPTIONS.length]!,
            docsSite: SITES[i % SITES.length]!,
            type: TYPES[i % TYPES.length]!,
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            creditsUsed: Math.floor(Math.random() * 50) + 1
        });
    }
    return data;
}

const sampleData = generateData(150);

// ------------------------------------------------------------------
// Stories
// ------------------------------------------------------------------

const meta: Meta<typeof DataTable> = {
    title: "UI/DataTable",
    component: DataTable,
    subcomponents: {
        "DataTable.Toolbar": DataTable.Toolbar,
        "DataTable.Content": DataTable.Content,
        "DataTable.Header": DataTable.Header,
        "DataTable.Body": DataTable.Body,
        "DataTable.Pagination": DataTable.Pagination,
        "DataTable.SearchBar": DataTable.SearchBar,
        "DataTable.ColumnFilter": DataTable.ColumnFilter
    },
    parameters: {
        layout: "padded",
        docs: {
            description: {
                component:
                    "A composable data table built on top of [TanStack Table](https://tanstack.com/table). " +
                    "Supports client-side and server-side pagination, column filtering, global search, sortable headers, " +
                    "and loading states (skeleton rows on initial load, spinner overlay on subsequent fetches). " +
                    "Composed via sub-components — `DataTable.Toolbar`, `DataTable.Content`, `DataTable.Header`, " +
                    "`DataTable.Body`, `DataTable.Pagination`, and `DataTable.SearchBar` — so the layout is fully flexible."
            }
        }
    },
    tags: ["autodocs"]
};

// Story descriptions are inlined below via parameters.docs.description.story

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    parameters: {
        docs: {
            description: {
                story: "Basic data table with toolbar, client-side sorting, column filtering, and pagination."
            }
        }
    },
    render: () => (
        <DataTable columns={columns} data={sampleData} initialPageSize={10}>
            <DataTable.Toolbar>
                <h3 className="text-base font-bold">Detailed usage info</h3>
                <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                        Export
                    </Button>
                    <Button variant="outline" size="sm">
                        Billing period
                    </Button>
                </div>
            </DataTable.Toolbar>
            <DataTable.Content>
                <DataTable.Header />
                <DataTable.Body />
            </DataTable.Content>
            <DataTable.Pagination />
        </DataTable>
    )
};

export const WithSearch: Story = {
    parameters: {
        docs: { description: { story: "Global search bar filters across all columns in real time." } }
    },
    render: () => (
        <DataTable columns={columns} data={sampleData} initialPageSize={10}>
            <DataTable.Toolbar>
                <h3 className="text-base font-bold">Usage with search</h3>
                <DataTable.SearchBar placeholder="Search usage..." className="w-64" />
            </DataTable.Toolbar>
            <DataTable.Content>
                <DataTable.Header />
                <DataTable.Body />
            </DataTable.Content>
            <DataTable.Pagination />
        </DataTable>
    )
};

export const SmallDataset: Story = {
    parameters: {
        docs: { description: { story: "When data fits on one page, pagination shows but is not needed." } }
    },
    render: () => {
        const smallData = generateData(5);
        return (
            <DataTable columns={columns} data={smallData} initialPageSize={10}>
                <DataTable.Toolbar>
                    <h3 className="text-base font-bold">Small dataset (no pagination needed)</h3>
                </DataTable.Toolbar>
                <DataTable.Content>
                    <DataTable.Header />
                    <DataTable.Body />
                </DataTable.Content>
                <DataTable.Pagination />
            </DataTable>
        );
    }
};

export const Empty: Story = {
    parameters: {
        docs: { description: { story: "Custom empty state via the `emptyState` prop on `DataTable.Body`." } }
    },
    render: () => (
        <DataTable columns={columns} data={[]}>
            <DataTable.Toolbar>
                <h3 className="text-base font-bold">Empty state</h3>
            </DataTable.Toolbar>
            <DataTable.Content>
                <DataTable.Header />
                <DataTable.Body emptyState={<span className="text-muted-foreground">No usage data found.</span>} />
            </DataTable.Content>
        </DataTable>
    )
};

export const ServerSidePagination: Story = {
    parameters: {
        docs: {
            description: {
                story: "Server-side pagination with `manualPagination` and `pageCount`. Data is sliced per page on the consumer side."
            }
        }
    },
    render: function ServerSideExample() {
        const pageSize = 10;
        const allData = sampleData;
        const [pageIndex, setPageIndex] = useState(0);

        const pageData = allData.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
        const pageCount = Math.ceil(allData.length / pageSize);

        return (
            <DataTable
                columns={columns}
                data={pageData}
                manualPagination
                pageCount={pageCount}
                onPaginationChange={(updater) => {
                    const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
                    setPageIndex(next.pageIndex);
                }}
            >
                <DataTable.Toolbar>
                    <h3 className="text-base font-bold">Server-side pagination</h3>
                </DataTable.Toolbar>
                <DataTable.Content>
                    <DataTable.Header />
                    <DataTable.Body />
                </DataTable.Content>
                <DataTable.Pagination />
            </DataTable>
        );
    }
};

export const ServerSideWithFetching: Story = {
    parameters: {
        docs: {
            description: {
                story: "Simulates async page fetches with an 800ms delay. Shows a spinner overlay on existing rows via `loading` prop."
            }
        }
    },
    render: function ServerSideFetchExample() {
        const pageSize = 10;
        const allData = sampleData;
        const totalPages = Math.ceil(allData.length / pageSize);

        const [pageIndex, setPageIndex] = useState(0);
        const [pageData, setPageData] = useState<UsageEntry[]>(allData.slice(0, pageSize));
        const [isLoading, setIsLoading] = useState(false);

        const fetchPage = (newPageIndex: number) => {
            setIsLoading(true);
            setPageIndex(newPageIndex);

            // Simulate a network request with a 800ms delay
            setTimeout(() => {
                const start = newPageIndex * pageSize;
                setPageData(allData.slice(start, start + pageSize));
                setIsLoading(false);
            }, 800);
        };

        return (
            <DataTable
                columns={columns}
                data={pageData}
                manualPagination
                pageCount={totalPages}
                onPaginationChange={(updater) => {
                    const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
                    fetchPage(next.pageIndex);
                }}
            >
                <DataTable.Toolbar>
                    <div>
                        <h3 className="text-base font-bold">Server-side with async fetching</h3>
                        <p className="text-sm text-muted-foreground">Page changes simulate an 800ms network delay</p>
                    </div>
                </DataTable.Toolbar>
                <DataTable.Content loading={isLoading}>
                    <DataTable.Header />
                    <DataTable.Body />
                </DataTable.Content>
                <DataTable.Pagination />
            </DataTable>
        );
    }
};

export const ServerSideInitialLoad: Story = {
    parameters: {
        docs: {
            description: {
                story: "Shows skeleton rows on initial load (no data yet), then a spinner overlay on subsequent page changes."
            }
        }
    },
    render: function ServerSideInitialLoadExample() {
        const pageSize = 10;
        const allData = sampleData;
        const totalPages = Math.ceil(allData.length / pageSize);
        const initialPage = useMemo(() => allData.slice(0, pageSize), [allData]);

        const [pageIndex, setPageIndex] = useState(0);
        const [pageData, setPageData] = useState<UsageEntry[]>([]);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            // Simulate initial data fetch
            const timeout = setTimeout(() => {
                setPageData(initialPage);
                setIsLoading(false);
            }, 1500);
            return () => clearTimeout(timeout);
        }, [initialPage]);

        const fetchPage = (newPageIndex: number) => {
            setIsLoading(true);
            setPageIndex(newPageIndex);

            setTimeout(() => {
                const start = newPageIndex * pageSize;
                setPageData(allData.slice(start, start + pageSize));
                setIsLoading(false);
            }, 800);
        };

        return (
            <DataTable
                columns={columns}
                data={pageData}
                manualPagination
                pageCount={totalPages}
                onPaginationChange={(updater) => {
                    const next = typeof updater === "function" ? updater({ pageIndex, pageSize }) : updater;
                    fetchPage(next.pageIndex);
                }}
            >
                <DataTable.Toolbar>
                    <div>
                        <h3 className="text-base font-bold">Server-side with initial load</h3>
                        <p className="text-sm text-muted-foreground">
                            Starts empty with skeleton rows, then loads after 1.5s
                        </p>
                    </div>
                </DataTable.Toolbar>
                <DataTable.Content loading={isLoading && pageData.length > 0}>
                    <DataTable.Header />
                    <DataTable.Body loading={isLoading} />
                </DataTable.Content>
                <DataTable.Pagination />
            </DataTable>
        );
    }
};

export const ClientSideWithFetching: Story = {
    parameters: {
        docs: {
            description: {
                story: "All data fetched once on mount, then sorting, filtering, and pagination are handled entirely client-side."
            }
        }
    },
    render: function ClientSideFetchExample() {
        const [data, setData] = useState<UsageEntry[]>([]);
        const [isLoading, setIsLoading] = useState(true);

        useEffect(() => {
            // Simulate fetching all data upfront
            const timeout = setTimeout(() => {
                setData(sampleData);
                setIsLoading(false);
            }, 1200);
            return () => clearTimeout(timeout);
        }, []);

        return (
            <DataTable columns={columns} data={data} initialPageSize={10}>
                <DataTable.Toolbar>
                    <div>
                        <h3 className="text-base font-bold">Client-side with initial fetch</h3>
                        <p className="text-sm text-muted-foreground">
                            All data fetched once (1.2s), then sorting/filtering/pagination is client-side
                        </p>
                    </div>
                    <DataTable.SearchBar placeholder="Search usage..." className="w-64" />
                </DataTable.Toolbar>
                <DataTable.Content loading={isLoading && data.length > 0}>
                    <DataTable.Header />
                    <DataTable.Body loading={isLoading} />
                </DataTable.Content>
                <DataTable.Pagination />
            </DataTable>
        );
    }
};

export const WithRoundedBorder: Story = {
    parameters: {
        docs: {
            description: {
                story: "Card-style container with `overflow-hidden rounded-lg border border-border` on the root `className`."
            }
        }
    },
    render: () => (
        <DataTable
            columns={columns}
            data={sampleData}
            initialPageSize={10}
            className="overflow-hidden rounded-lg border border-border"
        >
            <DataTable.Toolbar>
                <h3 className="text-base font-bold">Detailed usage info</h3>
                <div className="flex gap-3">
                    <Button variant="outline" size="sm">
                        Export
                    </Button>
                    <Button variant="outline" size="sm">
                        Billing period
                    </Button>
                </div>
            </DataTable.Toolbar>
            <DataTable.Content>
                <DataTable.Header />
                <DataTable.Body />
            </DataTable.Content>
            <DataTable.Pagination />
        </DataTable>
    )
};
