import type {FastifyReply, FastifyRequest} from "fastify";

import type AuthService from "../services/auth.js";
import type OAuthProvider from "../models/auth.js";
import type { OAuthUserInfo } from "models/user.js";
import { prisma } from "./prisma.js";



/**
 * Handles OAuth authentication flow for a given provider.
 *
 * Retrieves an access token, fetches user info, authenticates the user,
 * generates a signed JWT, and stores it in an HTTP-only cookie.
 *
 * @async
 * @function authHelper
 *
 * @param {FastifyRequest} req - The Fastify request object, containing OAuth state and code.
 * @param {FastifyReply} res - The Fastify reply object, used to set cookies on response.
 * @param {string} provider - The name of the OAuth provider (e.g., `"google"`, `"facebook"`).
 *
 * @returns {Promise<string>} A signed JWT access token for the authenticated user.
 *
 * @throws {AuthServiceError_t | Error} If the provider is invalid, token retrieval fails,
 * user info cannot be fetched, or JWT signing fails.
 *
 * @example
 * fastify.get('/auth/google/callback', async (req, res) => {
 *   const token = await authHelper(req, res, 'google');
 *   res.send({ access_token: token });
 * });
 */
export const authHelper = async (
    req: FastifyRequest, res: FastifyReply, provider: string
): Promise<string> => {

    let token = '';
    const authService: AuthService = req.server.service.auth;
    const oauthProvider: OAuthProvider | undefined = authService.providers[provider];

    if (!oauthProvider) {
        authService.throwErr({
            code: 500,
            message: 'chosen provider does not exist'
        });
    }
    const { access_token } = await oauthProvider!.getAccessToken(req);
    const user_info: OAuthUserInfo = await oauthProvider!.getUserInfo(access_token);
    
    const user = await prisma.user.findUnique({
        where: { email: user_info.email }
    });
    if (!user) {
        req.server
            .service
            .user.throwErr({
                code: 404,
                message: 'user doesn\'t exist'
            });
    }
    const user2faStatus = await req
        .server
        .service
        .totp
        .status(user!.id!);
    if (user2faStatus) {
        token = req.jwt.sign({
            uid: user!.id!,
            createdAt: user!.createdAt!,
            mfa_required: true
        }, {
            expiresIn: "5m"
        });

        res.setCookie('access_token', token, {
            path: '/',
            httpOnly: true,
            secure: true
        });
        
        return res.code(200).send({
            access_token: token,
            message: '2fa verification required, head to /v1/totp/verify'
        });
    }
    
    token = await authService.authenticate(user_info);

    res.setCookie('access_token', token, {
        path: '/',
        httpOnly: true,
        secure: true
    });

    return token;

}
