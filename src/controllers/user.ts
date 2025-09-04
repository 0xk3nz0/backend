import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "utils/prisma.js";
import bcrypt from "bcrypt";
import type UserModel from "../models/user.js";
import type { Prisma } from "generated/prisma/index.js";



export const userRegisterController = async (request: FastifyRequest<{ Body: {name: string, email: string, password: string} }>, reply: FastifyReply) => {

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
    const token = request.server.jwt.sign({ id: user.id, email: user.email });

    reply.code(201).send({
        message: '201 Created',
        user: {
            id: user.id,
            username: name,
            createdAt: user.createdAt
        },
        token
    });
}

export const userLoginController = async (req: FastifyRequest<{ Body: { email: string, password: string } }>, rep: FastifyReply) => {
    const fastify: FastifyInstance = req.server;
    const user: UserModel | null = await fastify.service.user.fetchBy({ 'email': req.body.email });
    if (user === null) {
        rep.code(404).send({
            statusCode: 404,
            message: 'not found!'
        });
    } else {
        if (user.password === req.body.password) {
            rep.code(200).send({
                uid: user.id,
                message: 'success!'
            });
        } else {
            rep.code(401).send({
                statusCode: 401,
                message: 'failed!'
            })
        }
    }
};

export const userProfileUpdateController = async (req: FastifyRequest<{ Body: { id: string, field: string, value: string } }>, rep: FastifyReply) => {
    /// i will assume that the user will be able to access the profile settings
    /// right there he can update those things, ...
    ///     - name
    ///     - avatar
    /// ...
    
    let update_data = {};
    switch (req.body.field) {
        
        case "name": {
            update_data = { name: req.body.value };
            break;
        }
        
        case "avatar": {
            update_data = { avatar: req.body.value };
            break;
        }

        /// you can add other things to change, for now ill stick with username & email.

        default: {
            throw Error("user attrib doesn't exist!");
        }
    
    };

    await req.server.service.user.updateBy({ id: req.body.id }, update_data);
    rep.code(200).send({
        uid: req.body.id,
        [Object.keys(update_data)[0] as string]: Object.values(update_data)[0],
        message: 'success!'
    });
};
