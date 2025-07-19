// app/logger.ts
import pino from "pino";

const logger = pino(
    await import("pino-pretty").then(pretty => ({
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
            },
        },
    }))
);

export default logger;
