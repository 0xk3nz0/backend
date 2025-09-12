import type {FastifyReply, FastifyRequest} from "fastify";

import type AuthService from "../services/auth.js";
import type OAuthProvider from "../models/auth.js";



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
