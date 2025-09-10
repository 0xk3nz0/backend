import type { FastifyReply, FastifyRequest } from "fastify";
import type { OAuthUserInfo } from "../models/user.js";
import { randomBytes } from 'crypto';
import bcrypt from "bcrypt";



export const googleOAuthCallbackController = async (
    req: FastifyRequest, res: FastifyReply
): Promise<void> => {

    const { token } = await req.server
        .googleOAuth2
        .getAccessTokenFromAuthorizationCodeFlow(req);
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
            Authorization: `Bearer ${token.access_token}`
        }
    });
    const user: OAuthUserInfo = await response.json();

    let db_user = await req.server.service.user.fetchBy({ email: user.email });
    if (!db_user) {
        const rndPwd = await bcrypt
            .hash(randomBytes(32).toString('hex'), 12);

        await req.server.service.user.create({
            name: user.name,
            email: user.email,
            password: rndPwd
        });
    }

    db_user = await req.server.service.user.fetchBy({ email: user.email });
    const payload = {
        uid: db_user!.id,
        createdAt: db_user!.createdAt
    };

    const jw_token = req.jwt.sign(payload, {
        expiresIn: "1h"
    });

    res.setCookie('access_token', jw_token, {
        path: '/',
        httpOnly: true,
        secure: true
    });

    res.code(200).send({
        access_token: jw_token
    });

}
