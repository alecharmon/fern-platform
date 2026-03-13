import winston from "winston";

const separator = "========================================";

const prettyJsonWithBars = winston.format.printf((info) => {
    return `${separator}\n${JSON.stringify(info, null, 2)}\n${separator}`;
});

export const LOGGER = winston.createLogger({
    level: "info",
    format: prettyJsonWithBars,
    transports: [
        new winston.transports.Console({
            format: prettyJsonWithBars
        })
    ]
});
