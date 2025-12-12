export class ConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConfigError";
    }
}

export class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export class OpenAITimeout extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OpenAITimeout";
    }
}

export class OpenAIRateLimited extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OpenAIRateLimited";
    }
}

export class OpenAIInvalidRequest extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OpenAIInvalidRequest";
    }
}

export class OpenAIServerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OpenAIServerError";
    }
}

export class OpenAIResponseParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "OpenAIResponseParseError";
    }
}

export class UnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnavailableError";
    }
}
