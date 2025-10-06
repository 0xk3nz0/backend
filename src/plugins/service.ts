import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { buildServiceManager } from "services/index.js";
import type { FastifyPluginOptions } from "fastify/types/plugin.js";



/**
 * Fastify plugin for initializing and decorating the service manager.
 *
 * This plugin attaches a `service` property to the Fastify instance,
 * giving access to all application services (e.g., `user`, `auth`, etc.).
 * The `buildServiceManager` factory is invoked with the Fastify instance
 * to ensure all services are properly initialized.
 *
 * @async
 * @function ServicePlugin
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} opts - Optional plugin configuration.
 *
 * @decorates {FastifyInstance.service} Provides a centralized service manager.
 *
 * @returns {Promise<void>} Resolves once the service manager is registered.
 *
 * @example
 * fastify.register(ServicePlugin);
 *
 * fastify.get('/health', async (req, res) => {
 *     const user = await fastify.service.user.fetchBy({ email: 'admin@example.com' });
 *    return { status: 'ok', adminExists: !!user };
 * });
 */
export default fp(async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {
    fastify.decorate("service", buildServiceManager(fastify));
});
