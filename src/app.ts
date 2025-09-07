import ajvErrors from "ajv-errors";
import { configDotenv } from "dotenv";
import Fastify, { type FastifyInstance } from 'fastify';
import { prisma as PrismaClientInstance } from './utils/prisma.js';
configDotenv();

import jwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";

import LoggingOpts from './utils/logger.js';

import PreHandler from './hooks/pre.js'
import SendHandler from './hooks/send.js'
import CloseHandler from './hooks/close.js';

import UserRoutes from './routes/user.js';
import TestRoutes from './routes/test.js';
import chatRoom from './routes/message.js';

import JWTAuthenticationPlugin from './plugins/jwt.js';
import ServiceManagerPlugin from './plugins/service.js';

// Export fastify instance in devlopment
export const fastify /*: FastifyInstance */ = Fastify({
    logger: LoggingOpts,
    ajv: {
        customOptions: {
            allErrors: true // ensures all validation errors are collected, not just the first
        },
        plugins: [ajvErrors] // enable ajv-errors
    }
});

await PrismaClientInstance.$connect();
fastify.log.info('Prisma connected ✅');

fastify.addHook('onClose', CloseHandler);
fastify.addHook('onSend', SendHandler);
fastify.addHook('preHandler', PreHandler);

fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecret"
});
fastify.register(fcookie, {
    secret: process.env.CKE_SECRET || "supersecret",
    hook: 'preHandler'
});
fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});
fastify.register(websocket);

fastify.register(ServiceManagerPlugin);
fastify.register(JWTAuthenticationPlugin);

fastify.register(chatRoom, { prefix: '/v1/ws' });
fastify.register(UserRoutes, { prefix: '/v1/user' });
fastify.register(TestRoutes, { prefix: '/v1/user' });


[ 'SIGINT', 'SIGTERM' ]
.forEach((signal_: string) => {
    process.on(signal_, async () => {
        await fastify.close();
        process.exit(0x0);
    });
});

// Healthcheck ROute
fastify.get('/', async (_, reply) => {
    reply.send({
        message: '200 ok'
    });
});

(async () => {
    try {
        await fastify.listen({
            host: '0.0.0.0',
            port: 3000
        });
    } catch (error) {
        if (error instanceof Error) {
            fastify.log.error(error.message);
        } else {
            fastify.log.error(error);
        }
        process.exit(0x1);
    }
})();
