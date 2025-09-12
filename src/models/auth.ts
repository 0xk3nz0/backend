import type { Token } from "@fastify/oauth2";
import type { FastifyRequest } from "fastify";
import type { OAuthUserInfo } from "./user.js";



/**
 * Interface for an OAuth provider.
 *
 * @interface OAuthProvider
 * @description
 * Defines the contract that any OAuth provider must implement
 * in order to integrate with the authentication service.
 */
export default interface OAuthProvider {

    /**
     * Exchange an authorization request for an access token.
     *
     * @param {FastifyRequest} req - The incoming Fastify request containing OAuth flow data.
     * @returns {Promise<Token>} A promise that resolves to the OAuth access token.
     */
    getAccessToken: (req: FastifyRequest) => Promise<Token>;

    /**
     * Fetch user information from the OAuth provider using an access token.
     *
     * @param {string} token - The OAuth access token.
     * @returns {Promise<OAuthUserInfo>} A promise that resolves to the user's profile info.
     */
    getUserInfo: (token: string) => Promise<OAuthUserInfo>;

}
