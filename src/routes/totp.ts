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



export default async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {

    fastify.get('/status', {
        handler: getStatusController,
        preHandler: [fastify.authentication_jwt]
    })

    fastify.put('/enable', {
        handler: enable2FAController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.put('/disable', {
        handler: disable2FAController,
        preHandler: [fastify.authentication_jwt]
    });

    fastify.get('/qr-code', {
        handler: getOTPAuthUrlController,
        preHandler: [fastify.authentication_jwt]
    })

    fastify.post('/verify', {
        handler: OTPVerificationController,
        preHandler: [fastify.authentication_jwt]
    })

};
