import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { JWTAuthentication } from "../middleware/user.js";



export default fp(async (fastify: FastifyInstance) => {
    fastify.decorate('authentication_jwt', JWTAuthentication);
});
