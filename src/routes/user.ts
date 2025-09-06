import { userRegisterController, userUplaodHandler, userLoginController, userProfileUpdateController } from "controllers/user.js";
import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { userRegisterSchema, userLoginSchema, userProfileUpdateSchema } from "schemas/user.js";



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

    fastify.post('/register', {
        schema: userRegisterSchema,
        handler: userRegisterController
    });

    fastify.post('/avatar', {
        // schema: userRegisterSchema,
        preHandler: [fastify.authenticate],
        handler: userUplaodHandler
    });

    fastify.post('/login', {
        schema: userLoginSchema,
        handler: userLoginController
    });

    fastify.put('/update', {
        schema: userProfileUpdateSchema,
        handler: userProfileUpdateController
    });

};

