import type {
    FastifyInstance,
    FastifyPluginOptions
} from "fastify";
import { googleOAuthCallbackController } from "../controllers/auth.js";



export default async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {

    fastify.get('/google/callback', {
        handler: googleOAuthCallbackController
    });

};
