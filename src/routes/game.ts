import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import websocket from "@fastify/websocket";
import { handleGameWebSocket } from "../controllers/game.js";

export default (fastify: FastifyInstance, options: FastifyPluginOptions) => {

  // fastify.register(websocket);

  fastify.get('/ws/game', { websocket: true }, async (connection, request) => {
    await handleGameWebSocket(connection, request);
  });

};
