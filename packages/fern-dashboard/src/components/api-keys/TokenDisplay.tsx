"use client";

import { useState } from "react";

export declare namespace TokenDisplay {
    export interface Props {
        title: string;
        token?: string;
        username?: string;
        password?: string;
        description: string;
    }
}

export function TokenDisplay({ title, token, username, password, description }: TokenDisplay.Props) {
    const [showToken, setShowToken] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const handleCopy = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-base font-semibold">{title}</h3>
            </div>
            <p className="mb-4 text-sm text-gray-600">{description}</p>

            {token && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Token</label>
                    <div className="flex gap-2">
                        <input
                            type={showToken ? "text" : "password"}
                            value={token}
                            readOnly
                            className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono"
                        />
                        <button
                            onClick={() => setShowToken(!showToken)}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            {showToken ? "Hide" : "Show"}
                        </button>
                        <button
                            onClick={() => handleCopy(token, "token")}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            {copiedField === "token" ? "Copied!" : "Copy"}
                        </button>
                    </div>
                </div>
            )}

            {username && password && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Username</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={username}
                                readOnly
                                className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono"
                            />
                            <button
                                onClick={() => handleCopy(username, "username")}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                {copiedField === "username" ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Password</label>
                        <div className="flex gap-2">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                readOnly
                                className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-mono"
                            />
                            <button
                                onClick={() => setShowPassword(!showPassword)}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                            <button
                                onClick={() => handleCopy(password, "password")}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
                            >
                                {copiedField === "password" ? "Copied!" : "Copy"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
