import { userRegisterController } from "controllers/user.js";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { userRegisterSchema } from "schemas/user.js";



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
export default async (fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> => {

    // Register a new user
    fastify.post('/register', {
        schema: userRegisterSchema,
        handler: userRegisterController
    });

};
