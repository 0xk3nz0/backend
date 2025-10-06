import type { FastifyReply, FastifyRequest } from "fastify";



/**
 * Hook that attaches the server's JWT instance to the request object.
 *
 * @param {FastifyRequest} req - The Fastify request object, extended with `jwt`.
 * @param {FastifyReply} res - The Fastify reply object (unused).
 *
 * @returns {Promise<void>} Resolves once the JWT instance is bound to the request.
 */
export default async (req: FastifyRequest, res: FastifyReply): Promise<void> => {
    req.jwt = req.server.jwt;
}
