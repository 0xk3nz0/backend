import type { FastifyInstance } from 'fastify';



/**
 * Fastify `onClose` hook.
 *
 * Logs a quitting message and exits the process when the server shuts down.
 *
 * @param {FastifyInstance} instance - The Fastify server instance.
 */
export default async (instance: FastifyInstance) => {
    instance.log.info('Quitting, ... bye 💨');
    process.exit(0x2e);
}
