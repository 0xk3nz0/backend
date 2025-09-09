import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { createRoomSchema } from "../schemas/room.js"
import { createRoomHandler } from "../controllers/room.js"

export const chatRoom = (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.post('/rooms', {
        schema: createRoomSchema,
        handler: createRoomHandler
    });

    // fastify.post('/message', {
    //     schema: sendMessageSchema,
    //     handler: sendMessageHandler
    // });
}
