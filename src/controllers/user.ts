import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import type UserModel from "models/user.js";
import type { UserServiceError_t } from "services/user.js";



/**
 * @param request
 * @param reply 
 * @returns 
 */
export const userRegisterController = async (request: FastifyRequest<{ Body: {name: string, email: string, password: string} }>, reply: FastifyReply) => {

    try {
        const user: UserModel | null = await request.server.service.user.create({
            name: request.body.name,
            email: request.body.email,
            password: request.body.password
        });
        if (user !== null) {
            reply.code(201).send({
                message: 'user created!',
                user: {
                    id: user.id,
                    username: user.name,
                    createdAt: user.createdAt
                }
            });
        } else {
            reply.code(500).send({ message: 'Tir Bzkok!' });
        }
    } catch (e: UserServiceError_t | unknown) {
        reply.code((e as UserServiceError_t).code).send({
            statusCode: (e as UserServiceError_t).code,
            error: (e as UserServiceError_t).message
        });
    }
    
}
