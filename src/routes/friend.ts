import {
    getFriendsController,
    getIncomingRequestsController,
    getPendingRequestsController,
    resolveFriendRequestController,
    sendFriendRequestController
} from "../controllers/friend.js";
import {
    getFriendsSchema,
    getIncomingRequestsSchema,
    getPendingRequestsSchema,
    resolveFriendRequestSchema,
    sendFriendRequestSchema
} from "../schemas/friend.js";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";



/**
 * Fastify plugin for friend request and friendship-related routes.
 *
 * This module registers all routes for managing friend requests and retrieving
 * friends or pending requests. Routes can access services, middlewares, and
 * request handlers via the Fastify instance and plugin options.
 *
 * All routes require JWT authentication, except for future public endpoints.
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} options - Plugin options passed when registering this plugin.
 * @returns {Promise<void>} Registers routes asynchronously.
 */
export default async (fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> => {

    fastify.post('/request', {
        schema: sendFriendRequestSchema,
        handler: sendFriendRequestController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.put('/respond', {
        schema: resolveFriendRequestSchema,
        handler: resolveFriendRequestController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.get('/friends', {
        schema: getFriendsSchema,
        handler: getFriendsController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.get('/pending', {
        schema: getPendingRequestsSchema,
        handler: getPendingRequestsController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.get('/incoming', {
        schema: getIncomingRequestsSchema,
        handler: getIncomingRequestsController,
        preHandler: [fastify.authentication_jwt]
    });

};
