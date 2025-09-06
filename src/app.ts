import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { prisma as PrismaClientInstance } from './utils/prisma.js';
import ServiceManagerPlugin from './plugins/service.js';
import LoggingOpts from './utils/logger.js';
import CloseHandler from './hooks/close.js';
import multipart from "@fastify/multipart";
import UserRoutes from './routes/user.js';
import SendHandler from './hooks/send.js'
import jwt from '@fastify/jwt';


export const fastify: FastifyInstance = Fastify({ logger: LoggingOpts });

await PrismaClientInstance.$connect();
fastify.log.info('Prisma connected ✅');

fastify.addHook('onClose', CloseHandler);
fastify.addHook('onSend', SendHandler);

fastify.register(ServiceManagerPlugin);
fastify.register(jwt, { secret: "supersecret" });
fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB
    }
});

fastify.register(UserRoutes, { prefix: '/v1/user' });

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
