interface CustomCardProps {
    title: string;
    text: string;
    link: string;
    sparkle?: boolean;
}

export const CustomCard = ({ title, text, link, sparkle = false }: CustomCardProps) => {
    return (
        <a
            href={link}
            className="block p-6 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all bg-white"
        >
            <h2 className="text-lg font-semibold mb-2 text-gray-900">
                {title} {sparkle && "✨"}
            </h2>
            <p className="text-sm text-gray-600">{text}</p>
        </a>
    );
};
