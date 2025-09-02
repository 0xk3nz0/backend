import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { registrationSchema, type RegisterBody } from "../validation/schema.js";
import { prisma } from "utils/prisma.js";
import bcrypt from "bcrypt";
import { email } from "zod";
import { required } from "zod/mini";
import type UserModel from "models/user.js";


// import service from "plugins/service.js";
// import type UserModel from "models/user.js";
// import fastify from "fastify";

function handler() {
    return ;
}


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

    // Get all users
    fastify.get('/', async (request, reply) => {
        const users = await prisma.user.findMany();
        return reply.send(users);
    });


    // delete a user by its name
    fastify.delete('/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
        const { name } = request.params;
        try {
            const user = await prisma.user.delete({
                where: { name }
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


    // Register a new user
    fastify.post('/register', {
        // preHandler: handler,
        schema: {
            body: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                    name: {
                        type: 'string',
                        minLength: 3
                    },
                    email: {
                        type: 'string',
                        format: 'email'
                    },
                    password: {
                        type: 'string',
                        minLength: 8,
                        // pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$'
                        // ✅ at least 8 chars, one letter, one number
                    }
                }
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                username: { type: 'string' },
                                createdAt: { type: 'string' }
                            }
                        },
                        token: { type: 'string' }
                    }
                }
            }
        }
    }, async (request: FastifyRequest<{ Body: {name: string, email: string, password: string} }>, reply: FastifyReply) => {

        const { name, email, password } = request.body; // as { email: string, password: string};

        // 1. Check if user exists
        const isUserExist = await prisma.user.findUnique({ 
            where: { email }
            // where: { OR: [{ email }, { name }] },
        });

        if (isUserExist) {
            return reply.code(400).send({ error: "Email or username already exists" });
        }

        // 2. Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Create user
        // fastify.service.user.create({ name, email, password } as UserModel);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            }
        });

        // 4. Generate JWT
        const token = fastify.jwt.sign({ id: user.id, email: user.email });

        reply.code(201).send({
            message: '201 Created',
            user: {
                id: user.id,
                username: name,
                createdAt: user.createdAt
            },
            token
        });
    });


    // Login an existing user
    fastify.post('/login', {
        schema: {
            body: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: {
                        type: 'string',
                        format: 'email'
                    },
                    password: {
                        type: 'string',
                        minLength: 8
                    }
                }
            },
            // response: {
            //     200: {
            //         type: 'object',
            //         propreties: {
            //             message: { type: 'string' },
            //             user: {
            //                 type: 'object',
            //                 properties: {
            //                     id: { type: 'string' },
            //                     username: { type: 'string' },
            //                     createdAt: { type: 'string' }
            //                 }
            //             },
            //             token: { type: 'string' }
            //         }
            //     }
            // }
        }
    }, async (request: FastifyRequest<{ Body: { email: string, password: string } }>, reply: FastifyReply) => {

        const { email, password } = request.body;

        // 1. Check if user already exists
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return reply.code(401).send({ error: 'Invalid email or password' });
        }

        // 2. Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return reply.code(401).send({ error: 'Invalid email or password' });
        }

        // 3. Generate JWT
        // const token = fastify.jwt.verify();
        const token = fastify.jwt.sign({ id: user.id, email: user.email });
        

        // 4. Send response
        reply.code(200).send({
            message: 'Login seccessful',
            user: {
                id: user.id,
                username: user.name,
                createdAt: user.createdAt
            },
            token
        });
    });


    fastify.post('/zido', async (req: FastifyRequest<{ Body: { name: string, email: string, password: string } }>, rep: FastifyReply) => {
        await fastify.service.user.create({
            name: req.body.name,
            email: req.body.email,
            password: req.body.password
        });
    });

};

