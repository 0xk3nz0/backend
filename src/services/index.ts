import type { FastifyInstance } from "fastify";
import type { ServiceManager } from "../types/service-manager.js";
import UserService from "./user.js";
import FriendService from "./friend.js";



/**
 * Builds and returns a ServiceManager instance containing all core services.
 * @param fastify - The Fastify server instance.
 * @returns An object with user and friend services.
 */
export function buildServiceManager(fastify: FastifyInstance): ServiceManager {
    return {
        user: new UserService(fastify),
        friend: new FriendService(fastify)
        /// add other services ...
    };
}
