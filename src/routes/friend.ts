import { getFriendsController, getPendingRequestsController, resolveFriendRequestController, sendFriendRequestController } from "../controllers/friend.js";
import { getFriendsSchema, getPendingRequestsSchema, resolveFriendRequestSchema, sendFriendRequestSchema } from "../schemas/friend.js";
import type {FastifyInstance, FastifyPluginOptions} from "fastify";



export default async (fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> => {

    fastify.post('/request', {
        schema: sendFriendRequestSchema,
        handler: sendFriendRequestController
    });

    fastify.put('/respond', {
        schema: resolveFriendRequestSchema,
        handler: resolveFriendRequestController
    });

    fastify.get('/friends', {
        schema: getFriendsSchema,
        handler: getFriendsController
    });

    fastify.get('/pending', {
        schema: getPendingRequestsSchema,
        handler: getPendingRequestsController
    });

};
