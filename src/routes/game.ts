import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { createGameSchema } from "../schemas/game.js"
import { createGameHandler } from "../controllers/game.js"

export default (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.post('/game', {
        schema: createGameSchema,
        handler: createGameHandler
    });

}
