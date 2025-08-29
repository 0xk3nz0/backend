import type { FastifyReply, FastifyRequest } from "fastify";



/**
 * Fastify `onSend` hook.
 *
 * Adds a custom `Server` header to every response.
 *
 * @param {FastifyRequest} req - The incoming Fastify request object.
 * @param {FastifyReply} res - The Fastify reply object, used to send the response.
 * @param {any} data - The payload that will be sent in the response.
 * @param {Function} done - Callback function to signal that the hook is finished.
 */
export default (req: FastifyRequest, res: FastifyReply, data: any, done: any | CallableFunction) => {
    res.headers({
        'Server': 'pong rush 1.0'
    });
    done();
}
