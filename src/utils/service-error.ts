import type { FastifyInstance } from "fastify";
import { PrismaClientKnownRequestError } from "../generated/prisma/runtime/library.js";



export type ServiceError_t = { code: number, message?: string };
export type BaseServiceError_t = Error & ServiceError_t;

type PErrRecord = {
    [key: string]: {
        code: number,
        message?: string
    }
};

/**
 * Checks if the given error is a ServiceError (has a numeric `code` property).
 * @param err - The error to check.
 * @returns True if the error is a ServiceError, false otherwise.
 */
export const isServiceError = (err: unknown): err is BaseServiceError_t => {
    return (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof (err as any).code === "number"
    );
}

/**
 * Abstract base class for service-level error handling.
 * Provides a mechanism to map Prisma error codes to HTTP status codes and messages.
 */
export default abstract class ServiceError {
    codes: Array<PErrRecord>;

    protected constructor () {
        this.codes = [];
    }

    abstract setupCodes(): void;

    getErr(code: string): ServiceError_t | undefined {
        for (const e of this.codes) {
            if (Object.keys(e)[0] === code) {
                return e[code];
            }
        }
        return {
            code: 500,
            message: `Prisma error code: ${code}`
        };
    }

    handleError(
        fastify: FastifyInstance,
        service: string,
        error: PrismaClientKnownRequestError | Error
    ): ServiceError_t | undefined {
        if (error instanceof PrismaClientKnownRequestError) {
            const err = this.getErr(error.code);
            fastify.log.error(`[${service}] -> ${err}`);
            return err;
        } else {
            fastify.log.error(`[${service}] -> ${error.message}`);
        }
    }

}

// 'P2000': { code: 400 },
// 'P2001': { code: 404 },
// 'P2002': { code: 409 },
// 'P2003': { code: 409 },
// 'P2004': { code: 400 },
// 'P2005': { code: 400 },
// 'P2006': { code: 400 },
// 'P2007': { code: 400 },
// 'P2008': { code: 400 },
// 'P2009': { code: 400 },
// 'P2010': { code: 500 },
// 'P2011': { code: 400 },
// 'P2012': { code: 400 },
// 'P2013': { code: 400 },
// 'P2014': { code: 400 },
// 'P2015': { code: 404 },
// 'P2016': { code: 400 },
// 'P2017': { code: 400 },
// 'P2018': { code: 404 },
// 'P2019': { code: 400 },
// 'P2020': { code: 400 },
// 'P2021': { code: 404 },
// 'P2022': { code: 404 },
// 'P2023': { code: 400 },
// 'P2024': { code: 500 },
// 'P2025': { code: 404 },
// 'P2026': { code: 400 },
// 'P2027': { code: 500 }