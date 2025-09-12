import "fastify";
import type { ServiceManager } from "./service-manager.js";
import type { JWT } from "@fastify/jwt";



declare module 'fastify' {

    interface FastifyInstance {
        service: ServiceManager;
        authentication_jwt: any;
        googleOAuth2: {
            getAccessTokenFromAuthorizationCodeFlow(
                request: FastifyRequest
            ): Promise<{
                token: {
                   access_token: string
                   refresh_token?: string
                   token_type: string
                   expires_in: number
               }
            }>;
            generateAuthorizationUri(
                req: FastifyRequest,
                res: FastifyReply
            ): string;
        };
        facebookOAuth2: {
            getAccessTokenFromAuthorizationCodeFlow(
                request: FastifyRequest
            ): Promise<{
                token: {
                    access_token: string;
                    refresh_token?: string;
                    token_type: string;
                    expires_in: number;
                };
            }>;
            generateAuthorizationUri(
                req: FastifyRequest,
                res: FastifyReply
            ): string;
        };
    }

    interface FastifyRequest {
        jwt: JWT;
    }

}
