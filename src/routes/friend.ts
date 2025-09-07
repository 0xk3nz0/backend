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
import type {FastifyInstance, FastifyPluginOptions} from "fastify";



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
