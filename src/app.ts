import Fastify, { type FastifyInstance } from 'fastify';
import { prisma as PrismaClientInstance } from './utils/prisma.js';
import { configDotenv } from "dotenv";
configDotenv();

import jwt from '@fastify/jwt';
import fcookie from '@fastify/cookie';
import multipart from "@fastify/multipart";

import LoggingOpts from './utils/logger.js';

import CloseHandler from './hooks/close.js';
import SendHandler from './hooks/send.js'
import PreHandler from './hooks/pre.js'

import UserRoutes from './routes/user.js';
import TestRoutes from './routes/test.js';

import ServiceManagerPlugin from './plugins/service.js';
import JWTAuthenticationPlugin from './plugins/jwt.js';



export const fastify: FastifyInstance = Fastify({ logger: LoggingOpts });

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

fastify.register(ServiceManagerPlugin);
fastify.register(JWTAuthenticationPlugin);

fastify.register(UserRoutes, { prefix: '/v1/user' });
fastify.register(TestRoutes, { prefix: '/v1/user' });


[ 'SIGINT', 'SIGTERM' ]
.forEach((signal_: string) => {
    process.on(signal_, async () => {
        await fastify.close();
        process.exit(0x0);
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
