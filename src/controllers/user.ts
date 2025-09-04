import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import type UserModel from "models/user.js";
import type { UserServiceError_t } from "services/user.js";



/**
 * @param request
 * @param reply 
 * @returns 
 */
export const userRegisterController = async (
    request: FastifyRequest<{ Body: {name: string, email: string, password: string} }>,
    reply: FastifyReply) => {

    try {
        const fastify: FastifyInstance = request.server;
        const user: UserModel | null = await fastify.service.user.create({
            name: request.body.name,
            email: request.body.email,
            password: request.body.password
        });
        if (!user) {
            reply.code(500).send({ message: 'Internal server error' });
        } else {
            reply.code(201).send({
                message: 'user created!',
                user: {
                    id: user.id,
                    username: user.name,
                    createdAt: user.createdAt
                }
            });
        }
    } catch (e: UserServiceError_t | unknown) {
        reply.code((e as UserServiceError_t).code).send({
            statusCode: (e as UserServiceError_t).code,
            error: (e as UserServiceError_t).message
        });
    }
    
}

export const userLoginController = async (
    req: FastifyRequest<{ Body: { email: string, password: string } }>,
    rep: FastifyReply
) => {
    const fastify: FastifyInstance = req.server;
    const user: UserModel | null = await fastify.service.user.fetchBy({ 'email': req.body.email });
    if (user === null) {
        rep.code(404).send({
            statusCode: 404,
            message: 'not found!'
        });
    } else {
        if (user.password === req.body.password) {
            rep.code(200).send({
                uid: user.id,
                message: 'success!'
            });
        } else {
            rep.code(401).send({
                statusCode: 401,
                message: 'failed!'
            })
        }
    }
};

