import "fastify";
import type { ServiceManager } from "./service-manager.js";



declare module "fastify" {
    interface FastifyInstance {
        service: ServiceManager;
    }
}
