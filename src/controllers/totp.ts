import type {
    FastifyReply,
    FastifyRequest
} from "fastify";

import type UserModel from "../models/user.js";
import { prisma } from "../utils/prisma.js";



export const getStatusController= async (
    req: FastifyRequest,
    rep: FastifyReply
): Promise<void> => {
    const status = await req.server.service.totp.status(req.user.uid);
    rep.code(200).send({ status });
}

export const enable2FAController = async (
    req: FastifyRequest,
    rep: FastifyReply
): Promise<void> => {
    await req.server.service.totp.enable(req.user.uid);
    rep.code(204);
}

export const disable2FAController = async (
    req: FastifyRequest,
    rep: FastifyReply
): Promise<void> => {
    await req.server.service.totp.disable(req.user.uid);
    rep.code(204);
}

export const getOTPAuthUrlController = async (
    req: FastifyRequest,
    rep: FastifyReply
): Promise<void> => {
    const user: UserModel | null = await req.server
        .service
        .user
        .fetchBy({ 'id': req.user.uid });
    const userSecret = await req.server
        .service
        .totp
        .getUserSecret(req.user.uid);
    if (!user) {
        rep.status(404).send({
            message: 'user not found'
        });
    } else {
        rep.status(200).send({
            url: req.server.service.totp.getOTPAuthUrl(
                userSecret,
                user.email,
                'PongRush'
            )
        });
    }
}

export const OTPVerificationController = async (req: FastifyRequest<{ Body: { mfa_code: string } }>, rep: FastifyReply) => {
    const user: UserModel | null = await req.server
        .service
        .user
        .fetchBy({ 'id': req.user.uid });
    const userSecret = await req.server
        .service
        .totp
        .getUserSecret(req.user.uid);
    const userToken = req.body.mfa_code;
    const result = req.server.service.totp.verify(userSecret, userToken);
    if (!result) {
        rep.code(401).send({
            statusCode: 401,
            error: 'Unauthorized!',
            message: 'invalid 2fa code 😡💢'
        });
    } else {
        const ujwt = req.cookies['access_token'];
        const decoded = req.jwt.decode<{ exp?: number }>(ujwt!);
        await prisma.blacklistedToken.create({
            data: {
                token: ujwt!,
                expiresAt: new Date(decoded!.exp! * 1000)
            }
        })
        const token = req.jwt.sign({
            uid: user!.id,
            createdAt: user!.createdAt,
            mfa_required: false
        }, {
            expiresIn: "1h"
        });

        rep.setCookie('access_token', token, {
            path: '/',
            httpOnly: true,
            secure: true
        });

        rep.code(200).send({
            access_token: token
        });
    }
}
