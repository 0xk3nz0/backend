import type {
    FastifyInstance,
    FastifyPluginOptions
} from "fastify";

import {
    disable2FAController,
    enable2FAController,
    getOTPAuthUrlController,
    getStatusController,
    OTPVerificationController
} from "../controllers/totp.js";



/**
 * Fastify plugin for two-factor authentication (2FA) routes.
 *
 * This module registers all routes related to managing and verifying TOTP-based 2FA.
 * It provides endpoints for enabling/disabling 2FA, fetching QR codes for setup,
 * checking 2FA status, and verifying OTP codes. All routes are protected with
 * JWT authentication via the `authentication_jwt` preHandler.
 *
 * Routes:
 *   - GET    /status    → Get current 2FA status for the authenticated user.
 *   - PUT    /enable    → Enable 2FA for the authenticated user.
 *   - PUT    /disable   → Disable 2FA for the authenticated user.
 *   - GET    /qr-code   → Get a QR code (as bytes) for setting up 2FA in an authenticator app.
 *   - POST   /verify    → Verify a submitted TOTP code for the authenticated user.
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} opts - Plugin options passed when registering this route.
 * @returns {Promise<void>} Registers routes asynchronously.
 */
export default async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {

    fastify.get('/status', {
        schema: { tags: [ "totp" ] },
        handler: getStatusController,
        preHandler: [fastify.authentication_jwt]
    })

    fastify.put('/enable', {
        schema: { tags: [ "totp" ] },
        handler: enable2FAController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.put('/disable', {
        schema: { tags: [ "totp" ] },
        handler: disable2FAController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.get('/qr-code', {
        schema: { tags: [ "totp" ] },
        handler: getOTPAuthUrlController,
        preHandler: [fastify.authentication_jwt]
    })

    fastify.post('/verify', {
        schema: { tags: [ "totp" ] },
        handler: OTPVerificationController,
        preHandler: [fastify.authentication_jwt]
    })

};
