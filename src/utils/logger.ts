
import fs from "fs";
import path from "path";
import { multistream } from "pino-multi-stream";

// Converts a relative path ("./logs") into an absolute path.
// const logDir = path.resolve("./logs");

// Checks if a file or directory exists at the given path.
// if (!fs.existsSync(logDir)) {
//     fs.mkdirSync(logDir, { recursive: true });
//     // { recursive: true }: Ensures that all parent directories are created if they don’t exist.
// }

// Create server.log file
// const logFile = fs.createWriteStream(path.join(logDir, "server.log"), { flags: "a" });

// const streams = [
//     { stream: logFile },
//     { stream: process.stdout },
// ];

export default {
    level: "trace", // log ALL levels: debug, info, warn, error, fatal
    // streams: multistream(streams),
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    },
};
