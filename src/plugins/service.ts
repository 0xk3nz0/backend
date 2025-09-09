import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { buildServiceManager } from "services/index.js";
import type { FastifyPluginOptions } from "fastify/types/plugin.js";



export default fp(async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {
    fastify.decorate("service", buildServiceManager(fastify));
});
