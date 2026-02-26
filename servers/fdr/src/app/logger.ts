import winston from "winston";

export const LOGGER = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.json()
        })
    ]
});
