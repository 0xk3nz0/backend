import {
    userRegisterController,
    userUploadHandler,
    userLoginController,
    userProfileUpdateController,
    userProfileController,
    userLogoutController, userRefreshTokController
} from "../controllers/user.js";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
    userRegisterSchema,
    userLoginSchema,
    userProfileSchema,
    userProfileUpdateSchema,
    userLogoutSchema
} from "schemas/user.js";



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
        schema: { tags: [ "users" ] },
        preHandler: [fastify.authentication_jwt],
        handler: userUploadHandler
    });

    fastify.post('/login', {
        schema: userLoginSchema,
        handler: userLoginController
    });

    fastify.get('/profile', {
        schema: userProfileSchema,
        handler: userProfileController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.put('/profile', {
        schema: userProfileUpdateSchema,
        handler: userProfileUpdateController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.post('/logout', {
        schema: userLogoutSchema,
        handler: userLogoutController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.get('/refresh', {
        handler: userRefreshTokController
    });

};

