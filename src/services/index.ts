import type { FastifyInstance } from "fastify";
import type { ServiceManager } from "../types/service-manager.js";
import UserService from "./user.js";



export function buildServiceManager(fastify: FastifyInstance): ServiceManager {
    return {
        user: new UserService(fastify),
        /// add more services when needed!
    };
}
