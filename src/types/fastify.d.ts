import "fastify";
import type { ServiceManager } from "./service-manager.js";
import type { JWT } from "@fastify/jwt";



declare module "fastify" {

    interface FastifyInstance {
        service: ServiceManager;
        authentication_jwt: any;
    }

    interface FastifyRequest {
        jwt: JWT;
    }

}
