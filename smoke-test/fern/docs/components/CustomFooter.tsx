export default function CustomFooter({ Fern }) {
    return (
        <footer className="w-full py-8 px-6 bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <Fern.Logo />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        Custom Footer - Plant Store API Documentation
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <Fern.Search />
                </div>
                <div className="flex items-center gap-4">
                    <Fern.ThemeSwitch />
                    <a
                        href="https://github.com/fern-api/fern"
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        GitHub
                    </a>
                    <a
                        href="https://buildwithfern.com"
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        Fern
                    </a>
                    <a
                        href="https://buildwithfern.com/contact"
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                        Contact
                    </a>
                </div>
            </div>
        </footer>
    );
}
