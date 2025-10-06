import type { FastifyInstance } from "fastify";
import { PrismaClient } from "../generated/prisma/index.js";



/**
 * Singleton PrismaClient instance for database access.
 */
export const prisma = new PrismaClient({ log: ['query', 'info', 'warn'] });

/**
 * Database service wrapper for Prisma within a Fastify application.
 *
 * This class provides a single PrismaClient instance that can be shared
 * across different services while being aware of which Fastify service
 * instantiated it (for debugging/logging purposes).
 */
export default class DataBaseWrapper {

    service: string;
    fastify: FastifyInstance;
    prisma: PrismaClient = prisma;

    constructor (service: string, fastify: FastifyInstance) {
        this.service = service;
        this.fastify = fastify;

        fastify.log.debug(`Database wrapper instantiated by ${this.service}.`);
    }

};
