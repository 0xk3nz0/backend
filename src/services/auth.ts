import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import type { Token } from "@fastify/oauth2";
import type { FastifyInstance, FastifyRequest } from "fastify";

import ServiceError, { type ServiceError_t } from "../utils/service-error.js";
import DataBaseWrapper from "../utils/prisma.js";
import type OAuthProvider from "../models/auth.js";
import type { OAuthUserInfo } from "../models/user.js";
import type { AuthServiceError_t } from "./user.js";



class GoogleOAuthProvider implements OAuthProvider {

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

    async getUserInfo(token: string): Promise<OAuthUserInfo> {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return await response.json();
    }

};

class FacebookOAuthProvider implements OAuthProvider {

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

    async getUserInfo(token: string): Promise<OAuthUserInfo> {
        const response = await fetch('https://graph.facebook.com/me?fields=id,name,email,picture', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return await response.json();
    }

};

class AuthServiceError extends ServiceError {

    constructor() {
        super();
        this.setupCodes();
    }

    setupCodes(): void {
        /// ... add codes later
    }

};

export default class AuthService extends DataBaseWrapper {

    errorHandler: AuthServiceError;
    providers: Record<string, OAuthProvider>;

    constructor(fastify: FastifyInstance) {
        super('auth.service', fastify);
        this.errorHandler = new AuthServiceError();
        this.providers = {
            google: new GoogleOAuthProvider(),
            facebook: new FacebookOAuthProvider(),
            /// ... add more providers
        }
    }

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

    private async verify(user_info: OAuthUserInfo): Promise<boolean> {
        let user = await this.fastify.service.user.fetchBy({
            email: user_info.email
        });
        return !!user;
    }

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

    public async authenticate(user_info: OAuthUserInfo): Promise<string> {
        if (!(await this.verify(user_info))) {
            await this.register(user_info);
        }
        const user = await this.fastify.service.user.fetchBy({
            email: user_info.email
        });
        return this.fastify.jwt.sign({
            uid: user!.id,
            createdAt: user!.createdAt
        }, {
            expiresIn: "1h"
        });
    }

};
