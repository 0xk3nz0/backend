import type {FastifyReply, FastifyRequest} from "fastify";

import type AuthService from "../services/auth.js";
import type OAuthProvider from "../models/auth.js";



export const authHelper = async (
    req: FastifyRequest, res: FastifyReply, provider: string
): Promise<string> => {

    const authService: AuthService = req.server.service.auth;
    const oauthProvider: OAuthProvider | undefined = authService.providers[provider];

    if (!oauthProvider) {
        authService.throwErr({
            code: 500,
            message: 'chosen provider does not exist'
        });
    }
    const { access_token } = await oauthProvider!.getAccessToken(req);
    const user_info = await oauthProvider!.getUserInfo(access_token);
    const token = await authService.authenticate(user_info);

    res.setCookie('access_token', token, {
        path: '/',
        httpOnly: true,
        secure: true
    });

    return token;

}
