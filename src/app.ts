import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { prisma as PrismaClientInstance } from './utils/prisma.js';
import ServiceManagerPlugin from './plugins/service.js';
import CloseHandler from './hooks/close.js';
import LoggingOpts from './utils/logger.js';
import SendHandler from './hooks/send.js';
import UserRoutes from './routes/user.js';
import jwt from '@fastify/jwt';
import dotenv from "dotenv";
import multipart from "@fastify/multipart";
import ajvErrors from 'ajv-errors';



dotenv.config();
const fastify: FastifyInstance = Fastify({
    logger: LoggingOpts,
    ajv: {
        customOptions: { 
        allErrors: true,   // show all errors
        strict: false,     // allow unknown keywords
        },
        plugins: [ajvErrors] // enable ajv-errors
    }
});

try {
    await PrismaClientInstance.$connect();
    fastify.log.info('Prisma connected ✅');
} catch (e) {
    fastify.log.info('Prisma failed ❌');
    process.exit(0x1);
}

fastify.addHook('onClose', CloseHandler);
fastify.addHook('onSend', SendHandler);

fastify.register(ServiceManagerPlugin);

fastify.register(UserRoutes, { prefix: '/v1/user' });
fastify.register(jwt, { secret: process.env.JWT || "supersecret" });
fastify.register(multipart);

[ 'SIGINT', 'SIGTERM' ]
.forEach((signal_: string) => {
    process.on(signal_, async () => {
        await fastify.close();
        process.exit(0x0);
    });
});

const PORT: number = parseInt(process.env.PORT || "3000");

(async () => {
    try {
        await fastify.listen({
            port: PORT
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
