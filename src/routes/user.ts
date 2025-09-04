import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import  { userRegisterController } from "controllers/user.js";
import  { userRegisterSchema } from "schemas/user.js";
import  { userLoginSchema } from "../schemas/user.js";
import  { userLoginController } from "../controllers/user.js";
import  { prisma } from "utils/prisma.js";



/**
 * Fastify plugin for user-related routes.
 *
 * This module registers all routes related to user operations (CRUD, filtering, etc.)
 * with the Fastify instance. It can access services, middlewares, and request handlers
 * through the Fastify instance and plugin options.
 *
 * @param {FastifyInstance} fastify - The Fastify server instance.
 * @param {FastifyPluginOptions} options - Plugin options passed when registering this route.
 * @returns {Promise<void>} Registers routes asynchronously.
 */
export default async (fastify: FastifyInstance, options: FastifyPluginOptions): Promise<void> => {

    // Register a new user
    fastify.post('/register', {
        schema: userRegisterSchema,
        handler: userRegisterController
    });

    fastify.post('/login', {
        schema: userLoginSchema,
        handler: userLoginController
    });

    // ============= LHAJ PLEASE IGNORE THIS FOR NOW ============= //

    // Get all users
    fastify.get('/', async (request, reply) => {
        const users = await prisma.user.findMany();
        return reply.send(users);
    });

    // Get one user by it's id
    fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        const user = await prisma.user.findUnique({
            where: { id }
        });
        return reply.send(user);
    });

    // delete a user by its name
    fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const { id } = request.params;
        try {
            const user = await prisma.user.delete({
                where: { id }
            });

            return reply.send({ message: "User deleted", user });
        } catch(error) {
            fastify.log.error("");
        }
    });


    // Delete all users
    fastify.delete('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await prisma.user.deleteMany({});
        reply.send({
            message: "Ina lilah database mchat",
            result
        });
    });

};
