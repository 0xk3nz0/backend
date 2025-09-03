import type {
    FastifyInstance,
    FastifyReply,
    FastifyRequest
} from "fastify";
import type UserModel from "../models/user.js";



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
