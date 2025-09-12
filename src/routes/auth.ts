import type {
    FastifyInstance,
    FastifyPluginOptions
} from "fastify";
import {
    facebookOAuthCallbackController,
    googleOAuthCallbackController
} from "../controllers/auth.js";



export default async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {

    fastify.get('/google/callback', {
        handler: googleOAuthCallbackController
    });

    fastify.get('/facebook/callback', {
       handler: facebookOAuthCallbackController
    });

};
