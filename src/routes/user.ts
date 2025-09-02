import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import type UserModel from "models/user.js";



/**
 * Fastify plugin for user-related routes.
 *
 * This module registers all routes related to user operations (CRUD, filtering, etc.)
 * with the Fastify instance. It can access services, middlewares, and request handlers
 * through the Fastify instance and plugin options.
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} options - Plugin options passed when registering this route.
 * @returns {Promise<void>} Registers routes asynchronously.
 */
export default async (fastify: FastifyInstance, options: FastifyPluginOptions) => {

    fastify.post('/zido', async (req: FastifyRequest<{ Body: { name: string, email: string, password: string } }>, rep: FastifyReply) => {
        await fastify.service.user.create({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password
        });
    });

};
