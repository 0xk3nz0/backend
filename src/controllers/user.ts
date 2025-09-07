import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { prisma } from "utils/prisma.js";
import type UserModel from "../models/user.js";
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { UserRegisterInput, UserLoginInput, UserUpdateInput } from "../models/user.js";



/**
 * @warning @Aziz018 i suppose not everyone uses kali, ... right?
 *          + i don't think it's a good idea to put this variable here
 *          i mean we should create a consts.ts file and have those
 *          variables exported out of it ... !
 *          we could export those
 *              - UPLOAD_DIR
 *              - DEFAULT_JWT_KEY
 *              - DEFAULT_CKE_KEY
 *          instead of "supersecret", ... or put this UPLOAD_DIR
 *          in the .env file ... ?!
 */
const UPLOAD_DIR = "/home/kali/Desktop/PFE/backend/public/images";

export const userUploadHandler = async (request: FastifyRequest<{ Body: { description: string } }>, reply: FastifyReply) => {

    const data = await request.file();
    if (!data) {
        return reply.code(400).send({ error: "No file uploaded" });
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });


    request.log.debug(`filename: ${data.filename}`);
    request.log.debug(`mimetype: ${data.mimetype}`);

    if (!["image/png", "image/jpeg"].includes(data.mimetype)) {
      return reply.code(400).send({ error: "Invalid file type" });
    }

    const timestamp = Date.now();
    const ext = path.extname(data.filename);
    const safeName = path.basename(data.filename, ext).replace(/\s+/g, "_");
    const filename = `${timestamp}_${safeName}${ext}`;
    const uploadPath = path.join(UPLOAD_DIR, filename);
    request.log.debug(uploadPath);

    try 
    {
        await new Promise<void>((resolve, reject) => {
            const writeStream = fs.createWriteStream(uploadPath);
            data.file.pipe(writeStream);
            data.file.on("end", resolve);
            data.file.on("error", reject);
        });
    } catch(e) {
        request.log.error("something happened!");
    }

    return {
        success: true,
        filename: data.filename,
    };
}

export const userRegisterController = async (
    request: FastifyRequest<{ Body: UserRegisterInput }>, reply: FastifyReply
): Promise<void> => {

    const { name, email, password } = request.body; // as { email: string, password: string};

    // 1. Check if user exists
    const isUserExist = await prisma.user.findUnique({ 
        where: { email }
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

    reply.code(201).send({
        message: '201 Created',
        user: {
            id: user.id,
            username: name,
            createdAt: user.createdAt
        }
    });
}

export const userLoginController = async (
    req: FastifyRequest<{ Body: UserLoginInput }>, rep: FastifyReply
): Promise<void> => {
    const fastify: FastifyInstance = req.server;
    const user: UserModel | null = await fastify.service.user.fetchBy({ 'email': req.body.email });

    if (user === null) {
        rep.code(404).send({
            statusCode: 404,
            message: 'not found!'
        });
    } else {
        fastify.log.info(user);
            fastify.log.info(`comparing ${req.body.password} with ${user.password}`);
        const isValid = await bcrypt.compare(req.body.password, user.password || "");
        fastify.log.info(isValid);
        if (isValid) {
            const payload = {
                uid: user.id,
                name: user.name,
                createdAt: user.createdAt
            };

            const token = req.jwt.sign(payload);

            rep.setCookie('access_token', token, {
                path: '/',
                httpOnly: true,
                secure: true,
            });

            rep.code(200).send({
                access_token: token
            });
        } else {
            rep.code(401).send({
                statusCode: 401,
                message: 'failed!'
            })
        }
    }
}

export const userProfileController = async (
    req: FastifyRequest, rep: FastifyReply
): Promise<void> => {
    rep.code(200).send({
        uid: req.user.uid,
        name: req.user.name,
        createdAt: req.user.createdAt
    });
}

export const userProfileUpdateController = async (
    req: FastifyRequest<{ Body: UserUpdateInput }>, rep: FastifyReply
): Promise<void> => {
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

    await req.server.service.user.updateBy({ id: req.user.uid }, update_data);
    rep.code(200).send({
        message: 'success!'
    });
}
