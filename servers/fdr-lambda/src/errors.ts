export class DomainNotRegisteredError extends Error {
    constructor() {
        super("Domain not registered");
        this.name = "DomainNotRegisteredError";
    }
}

export class InvalidUrlError extends Error {
    constructor(url: string, originalError: Error) {
        super(`Invalid URL: ${url}`);
        this.name = "InvalidUrlError";
        this.cause = originalError;
    }
}

export class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export class UserNotInOrgError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UserNotInOrgError";
    }
}

export class UnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnavailableError";
    }
}
