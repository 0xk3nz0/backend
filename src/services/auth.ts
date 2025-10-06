import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import type { Token } from "@fastify/oauth2";
import type { FastifyInstance, FastifyRequest } from "fastify";

import ServiceError, { type ServiceError_t } from "../utils/service-error.js";
import DataBaseWrapper from "../utils/prisma.js";
import type OAuthProvider from "../models/auth.js";
import type { OAuthUserInfo } from "../models/user.js";
import type { AuthServiceError_t } from "./user.js";



/**
 * Implementation of the Google OAuth provider.
 * Handles token exchange and user info retrieval via Google's OAuth2 API.
 */
class GoogleOAuthProvider implements OAuthProvider {

    /**
     * Retrieves an access token from Google using the authorization code flow.
     *
     * @param {FastifyRequest} req - The incoming Fastify request containing OAuth state and code.
     * @returns {Promise<Token>} Resolves to a token object with expiration and type details.
     * @throws {Error} If token retrieval fails.
     */
    async getAccessToken(req: FastifyRequest): Promise<Token> {
        const { token } = await req.server
            .googleOAuth2
            .getAccessTokenFromAuthorizationCodeFlow(req);
        return {
            ...token,
            expires_at: new Date(Date.now() + token.expires_in * 1000),
            token_type: "Bearer" as const
        };
    }

    /**
     * Fetches user profile information from Google APIs.
     *
     * @param {string} token - The OAuth2 access token.
     * @returns {Promise<OAuthUserInfo>} Resolves with the user information object.
     * @throws {Error} If fetching user info fails.
     */
    async getUserInfo(token: string): Promise<OAuthUserInfo> {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return await response.json();
    }

};

/**
 * Implementation of the Facebook OAuth provider.
 * Handles token exchange and user info retrieval via Facebook's OAuth2 API.
 */
class FacebookOAuthProvider implements OAuthProvider {

    /**
     * Retrieves an access token from Facebook using the authorization code flow.
     *
     * @param {FastifyRequest} req - The incoming Fastify request containing OAuth state and code.
     * @returns {Promise<Token>} Resolves to a token object with expiration and type details.
     * @throws {Error} If token retrieval fails.
     */
    async getAccessToken(req: FastifyRequest): Promise<Token> {
        const { token } = await req.server
            .facebookOAuth2
            .getAccessTokenFromAuthorizationCodeFlow(req);
        return {
            ...token,
            expires_at: new Date(Date.now() + token.expires_in * 1000),
            token_type: "Bearer" as const
        };
    }

    /**
     * Fetches user profile information from Facebook Graph API.
     *
     * @param {string} token - The OAuth2 access token.
     * @returns {Promise<OAuthUserInfo>} Resolves with the user information object.
     * @throws {Error} If fetching user info fails.
     */
    async getUserInfo(token: string): Promise<OAuthUserInfo> {
        const response = await fetch('https://graph.facebook.com/me?fields=id,name,email,picture', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return await response.json();
    }

};

/**
 * Specialized error handler for the authentication service.
 * Extends base `ServiceError` and registers error codes.
 */
class AuthServiceError extends ServiceError {

    /**
     * Constructs the authentication service error handler.
     * Initializes error codes on creation.
     */
    constructor() {
        super();
        this.setupCodes();
    }

    /**
     * Defines error codes specific to authentication.
     * Extend this to map error identifiers to messages.
     */
    setupCodes(): void {
        /// ... add codes later
    }

};

/**
 * Authentication service managing OAuth providers, user verification,
 * registration, and JWT-based authentication.
 */
export default class AuthService extends DataBaseWrapper {

    /** Error handler instance for authentication-related failures. */
    errorHandler: AuthServiceError;

    /** Available OAuth providers (Google, Facebook, etc.). */
    providers: Record<string, OAuthProvider>;

    /**
     * Initializes the authentication service with a Fastify instance.
     *
     * @param {FastifyInstance} fastify - The Fastify server instance.
     */
    constructor(fastify: FastifyInstance) {
        super('auth.service', fastify);
        this.errorHandler = new AuthServiceError();
        this.providers = {
            google: new GoogleOAuthProvider(),
            facebook: new FacebookOAuthProvider(),
            /// ... add more providers
        };
    }

    /**
     * Throws a typed authentication error if defined, otherwise a generic error.
     *
     * @param {ServiceError_t | undefined} err - The error object.
     * @throws {AuthServiceError_t | Error} Typed error or generic error.
     */
    throwErr(err: ServiceError_t | undefined) {
        if (err !== undefined) {
            const e: AuthServiceError_t = Object.assign(new Error(err.message), {
                code: err.code,
                message: err.message
            });
            throw e;
        } else {
            throw Error("Unknown Error Occured!");
        }
    }

    /**
     * Checks if a user already exists in the database based on their email.
     *
     * @private
     * @param {OAuthUserInfo} user_info - The user info object retrieved from an OAuth provider.
     * @returns {Promise<boolean>} True if user exists, false otherwise.
     */
    private async verify(user_info: OAuthUserInfo): Promise<boolean> {
        let user = await this.fastify.service.user.fetchBy({
            email: user_info.email
        });
        return !!user;
    }

    /**
     * Registers a new user in the database using OAuth profile data.
     * Generates a random password for the new account.
     *
     * @private
     * @param {OAuthUserInfo} user_info - The user info object retrieved from an OAuth provider.
     * @returns {Promise<void>} Resolves when the user is created.
     */
    private async register(user_info: OAuthUserInfo): Promise<void> {
        const rndpwd = await bcrypt.hash(
            randomBytes(32).toString("hex"), 12
        );
        await this.fastify.service.user.create({
            name: user_info.name,
            email: user_info.email,
            password: rndpwd
        })
    }

    /**
     * Authenticates a user by verifying existence, registering if new,
     * and returning a signed JWT.
     *
     * @param {OAuthUserInfo} user_info - The user info object retrieved from an OAuth provider.
     * @returns {Promise<string>} A signed JWT valid for one hour.
     * @throws {Error} If verification, registration, or JWT signing fails.
     */
    public async authenticate(user_info: OAuthUserInfo): Promise<string> {
        if (!(await this.verify(user_info))) {
            await this.register(user_info);
        }
        const user = await this.fastify.service.user.fetchBy({
            email: user_info.email
        });
        return this.fastify.jwt.sign({
            uid: user!.id,
            createdAt: user!.createdAt,
            mfa_required: false
        }, {
            expiresIn: "1h"
        });
    }

};
