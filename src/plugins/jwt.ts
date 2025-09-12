import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { JWTAuthentication } from "../middleware/user.js";
import type { FastifyPluginOptions } from "fastify/types/plugin.js";



/**
 * Fastify plugin for JWT-based authentication.
 *
 * This plugin decorates the Fastify instance with an `authentication_jwt` method,
 * which can be used as a `preHandler` in routes to enforce user authentication.
 * The method validates JWT tokens and attaches the decoded payload to the request.
 *
 * @async
 * @function JWTAuthenticationPlugin
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} opts - Optional plugin configuration.
 *
 * @decorates {FastifyInstance.authentication_jwt} Middleware function to verify JWTs.
 *
 * @returns {Promise<void>} Resolves once the authentication method is registered.
 *
 * @example
 * fastify.register(JWTAuthenticationPlugin);
 *
 * fastify.get('/profile', {
 *   preHandler: [fastify.authentication_jwt],
 *   handler: async (req, res) => {
 *     return { user: req.user };
 *   }
 * });
 */
export default fp(async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {
    fastify.decorate('authentication_jwt', JWTAuthentication);
});
