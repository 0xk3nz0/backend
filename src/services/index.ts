import type { FastifyInstance } from "fastify";
import type { ServiceManager } from "../types/service-manager.js";
import UserService from "./user.js";
import FriendService from "./friend.js";



export function buildServiceManager(fastify: FastifyInstance): ServiceManager {
    return {
        user: new UserService(fastify),
        friend: new FriendService(fastify)
        /// add other services ...
    };
}
