import type { FastifyInstance } from "fastify";
import type { PrismaClientKnownRequestError } from "generated/prisma/runtime/library.js";



type PErrRecord = {
    [key: string]: {
        code: number,
        message?: string
    }
};

export default abstract class ServiceError {
    codes: Array<PErrRecord>;

    constructor () {
        this.codes = [];
    }

    abstract handleError(fastify: FastifyInstance, service: string, error: PrismaClientKnownRequestError | Error): { code: number, message?: string } | undefined;
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