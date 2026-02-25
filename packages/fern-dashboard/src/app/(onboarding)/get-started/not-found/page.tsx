interface NotFoundPageProps {
    searchParams?: Promise<{
        "postman-team-id"?: string;
    }>;
}

export default async function NotFoundPage({ searchParams }: NotFoundPageProps) {
    const postmanTeamId = (await searchParams)?.["postman-team-id"];

    return (
        <div className="flex min-h-screen items-center justify-center p-4 max-w-[450px]">
            <div className="text-center">
                <h1 className="text-2xl font-semibold mb-4">
                    {postmanTeamId ? (
                        <>
                            You are not a part of the <code className="font-mono text-primary">{postmanTeamId}</code>{" "}
                            Postman team.
                        </>
                    ) : (
                        <p className="text-muted-foreground">Not found.</p>
                    )}
                </h1>
                {postmanTeamId && (
                    <p className="text-muted-foreground">
                        Please be sure you enter this flow from Postman and that you are logged in with your Postman
                        account.
                    </p>
                )}
            </div>
        </div>
    );
}
