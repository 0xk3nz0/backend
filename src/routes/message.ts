import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { createRoomSchema } from "../schemas/room.js"
import { createRoomHandler } from "../controllers/room.js"
import { createMessageSchema, getMessageSchema } from "../schemas/message.js"
import { websocketHandler, createMessageHandler, getMessageHandler } from "../controllers/message.js"

export const chatRoom = (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.post('/rooms', {
        schema: createRoomSchema,
        handler: createRoomHandler
    });

    fastify.post('/messages', {
        schema: createMessageSchema,
        handler: createMessageHandler
    });

    fastify.get('/messages', {
        schema: getMessageSchema,
        handler: getMessageHandler
    });

    fastify.get('/ws', { websocket: true }, websocketHandler);
}
