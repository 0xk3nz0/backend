import type { FastifyInstance } from "fastify";

import UserService from "./user.js";
import FriendService from "./friend.js";
import AuthService from "./auth.js";
import TOTPService from "./totp.js";
import type { ServiceManager } from "../types/service-manager.js";



/**
 * Builds and returns a ServiceManager instance containing all core services.
 * @param fastify - The Fastify server instance.
 * @returns An object with user and friend services and more.
 */
export function buildServiceManager(fastify: FastifyInstance): ServiceManager {
    return {
        user: new UserService(fastify),
        friend: new FriendService(fastify),
        auth: new AuthService(fastify),
        totp: new TOTPService(fastify)
        /// ... add other services !
    };
}
