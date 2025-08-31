import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';

import LoggingOpts from './utils/logger.js';
import CloseHandler from './hooks/close.js';
import SendHandler from './hooks/send.js'
import { prisma as PrismaClientInstance } from './utils/prisma.js';
import UserRoutes from './routes/user.js';



const fastify: FastifyInstance = Fastify({ logger: LoggingOpts });

await PrismaClientInstance.$connect();
fastify.log.info('Prisma connected ✅');

fastify.addHook('onClose', CloseHandler);
fastify.addHook('onSend', SendHandler);

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
