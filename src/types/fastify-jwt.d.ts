import "@fastify/jwt";
import type {UserJWTPayload} from "../models/user.js";



declare module "@fastify/jwt" {
    interface FastifyJWT {
        user: UserJWTPayload;
    }
}
