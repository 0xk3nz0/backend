import fs from "fs";
import path from "path";
import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";

export default async (fastify: FastifyInstance, options: FastifyPluginOptions) => {
    fastify.post('/post', async (request: FastifyRequest, reply: FastifyReply) => {
        // request.file();
    });
}
