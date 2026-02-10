import { useCallback, useEffect, useState } from "react";
import { FOOTER_COLUMNS } from "./footer-links";

export default function CustomFooter() {
    const [mounted, setMounted] = useState(false);
    const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleColumn = useCallback((title: string) => {
        setExpandedColumn((prev) => (prev === title ? null : title));
    }, []);

    return (
        <footer className="w-full py-8 px-6 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {FOOTER_COLUMNS.map((column) => (
                        <div key={column.title}>
                            <button
                                onClick={() => toggleColumn(column.title)}
                                className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 md:cursor-default md:pointer-events-none flex items-center gap-1 bg-transparent border-none p-0"
                            >
                                {column.title}
                                <span
                                    className="md:hidden text-xs transition-transform"
                                    style={{
                                        transform: expandedColumn === column.title ? "rotate(180deg)" : "rotate(0deg)"
                                    }}
                                >
                                    ▼
                                </span>
                            </button>
                            <ul
                                className="list-none p-0 m-0 flex flex-col gap-2"
                                style={{
                                    display: !mounted || expandedColumn === column.title ? "flex" : undefined
                                }}
                            >
                                {column.links.map((link) => (
                                    <li key={link.label} className="m-0 p-0">
                                        <a
                                            href={link.href}
                                            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors no-underline"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-800 pt-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-500 m-0">
                        © {new Date().getFullYear()} Plant Store. Built with Fern.
                    </p>
                </div>
            </div>
        </footer>
    );
}
