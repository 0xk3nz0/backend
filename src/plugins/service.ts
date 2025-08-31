import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { buildServiceManager } from "services/index.js";



export default fp(async (fastify: FastifyInstance) => {
    fastify.decorate("service", buildServiceManager(fastify));
});
