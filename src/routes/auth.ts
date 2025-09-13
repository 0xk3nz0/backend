import type {
    FastifyInstance,
    FastifyPluginOptions
} from "fastify";
import {
    facebookOAuthCallbackController,
    googleOAuthCallbackController
} from "../controllers/auth.js";



/**
 * Fastify plugin for OAuth callback routes.
 *
 * This module registers the callback endpoints for external OAuth providers.
 * It handles the provider's response after the user authorizes the application.
 * The handlers exchange authorization codes for access tokens and fetch user info.
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} opts - Plugin options passed when registering this plugin.
 * @returns {Promise<void>} Registers OAuth callback routes asynchronously.
 */
export default async (fastify: FastifyInstance, opts: FastifyPluginOptions): Promise<void> => {

    fastify.get('/google/callback', {
        schema: { tags: [ "oauth" ] },
        handler: googleOAuthCallbackController
    });

    fastify.get('/facebook/callback', {
        schema: { tags: [ "oauth" ] },
        handler: facebookOAuthCallbackController
    });

};
