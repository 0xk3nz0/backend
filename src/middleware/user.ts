import type { FastifyRequest, FastifyReply } from "fastify";
import type { FastifyJWT } from "@fastify/jwt";
import {prisma} from "../utils/prisma.js";
import user from "../routes/user.js";



/**
 * Middleware that enforces authentication using a JWT stored in cookies.
 *
 * - Looks for the `access_token` cookie in the incoming request.
 * - If the token is missing, responds with `401 Unauthorized`.
 * - If present, verifies the token with `req.jwt.verify`.
 * - On success, attaches the decoded payload to `req.user`.
 *
 * @param {FastifyRequest} req - The Fastify request object.
 *                               Extended with:
 *                                  - `jwt` (from fastify-jwt)
 *                                  - `user` (decoded token payload).
 * @param {FastifyReply} rep - The Fastify reply object, used to send error responses.
 *
 * @returns {Promise<void>} Resolves when authentication is validated.
 */
export const JWTAuthentication = async (
    req: FastifyRequest, rep: FastifyReply): Promise<void> => {
    const token = req.cookies.access_token;

    if (!token) {
        return rep.status(401).send({
            message: "Authentication required"
        });
    }

    const isBlackListed = await prisma.blacklistedToken.findUnique({
        where: { token }
    });
    if (isBlackListed) {
        return rep.code(401).send({
            statusCode: 401,
            error: 'Unauthorized!',
            message: 'token blacklisted, please login again!'
        });
    }

    const decoded = req.jwt.verify<FastifyJWT['user']>(token);

    /**
     * @warning make sure the user is mfa_required set to false
     * @note how can i make exceptions? like he can access verify
     *       only and only if the mfa_required is set to true ??
     */

    if (req.url === '/v1/totp/verify') {
        if (!decoded.mfa_required) {
            return rep.code(401).send({
                statusCode: 401,
                error: 'Unauthorized!',
                message: 'you are not supposed to be here, you are already verified!'
            });
        }
    } else if (decoded.mfa_required) {
        return rep.code(401).send({
            statusCode: 401,
            error: 'Unauthorized!',
            message: 'you are not supposed to be here, you are not verified!'
        });
    }

    req.user = decoded;

}


