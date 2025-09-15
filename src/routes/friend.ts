import {
    blockUserController,
    getBlockedUsersController,
    getFriendsController,
    getIncomingRequestsController,
    getPendingRequestsController,
    resolveFriendRequestController,
    sendFriendRequestController,
    unblockUserController
} from "../controllers/friend.js";
import {
    blockUserSchema,
    getBlockedUsersSchema,
    getFriendsSchema,
    getIncomingRequestsSchema,
    getPendingRequestsSchema,
    resolveFriendRequestSchema,
    sendFriendRequestSchema,
    unblockUserSchema
} from "../schemas/friend.js";
import type {
    FastifyInstance,
    FastifyPluginOptions
} from "fastify";



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

    fastify.post('/block', {
        schema: blockUserSchema,
        handler: blockUserController,
        preHandler: [fastify.authentication_jwt] 
    });

    fastify.post('/unblock', {
        schema: unblockUserSchema,
        handler: unblockUserController,
        preHandler: [fastify.authentication_jwt] 
    });

    fastify.get('/blocked', {
        schema: getBlockedUsersSchema,
        handler: getBlockedUsersController,
        preHandler: [fastify.authentication_jwt] 
    });

};
