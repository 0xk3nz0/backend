import type { Token } from "@fastify/oauth2";
import type { FastifyRequest } from "fastify";
import type { OAuthUserInfo } from "./user.js";



export default interface OAuthProvider {
    getAccessToken: (req: FastifyRequest) => Promise<Token>;
    getUserInfo: (token: string) => Promise<OAuthUserInfo>;
}
