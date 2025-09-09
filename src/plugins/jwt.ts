import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { JWTAuthentication } from "../middleware/user.js";
import type { FastifyPluginOptions } from "fastify/types/plugin.js";



export default fp(async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {
    fastify.decorate('authentication_jwt', JWTAuthentication);
});
