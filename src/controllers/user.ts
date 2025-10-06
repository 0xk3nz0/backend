import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import bcrypt from "bcrypt";
import { prisma } from "utils/prisma.js";
import type UserModel from "../models/user.js";
import { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import type { UserRegisterInput, UserLoginInput, UserUpdateInput } from "../models/user.js";

// ======  Heisenberg Part  ====== //

const UPLOAD_DIR = "./public/images";

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

// Chat handler
// export const chatWebsocketHandler = async (webSocket: WebSocket, request: FastifyRequest) => {

// }

// ======  Lh4j Part  ====== //

const rateLimits = new Map<string, { count: number, resetTime: number }>(); // key: userId

const checkRateLimit = (userId: string | undefined, maxRequests = 10, windowMs = 60000) => {
    if (!userId) {
        return false;
    }

    const now = Date.now();
    
    // Get or create rate limit entry for this user
    let rateLimit = rateLimits.get(userId);

    // If no entry exists or the window has expired, create/reset it
    if (!rateLimit || now > rateLimit.resetTime) {
        rateLimits.set(userId, { count: 1, resetTime: now + windowMs });
        return true;
    }

    // Check if user has exceeded the limit
    if (rateLimit.count >= maxRequests) {
        return false;
    }

    // Increment the counter
    rateLimit.count++;
    return true;
};

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
        const isValid = await bcrypt.compare(req.body.password, user.password!);
        if (isValid) {

            let token: string = '';
            const user2faStatus = await fastify.service.totp.status(user.id!);
            if (user2faStatus) {
                token = req.jwt.sign({
                    uid: user.id,
                    createdAt: user.createdAt,
                    mfa_required: true
                }, {
                    expiresIn: "5m"
                });

                rep.setCookie('access_token', token, {
                    path: '/',
                    httpOnly: true,
                    secure: true
                });

                return rep.code(200).send({
                    access_token: token,
                    message: '2fa verification required, head to /v1/totp/verify'
                });
            }

            /**
             * @warning this is the new payload
             *          in other word, the user attempts to login
             *          we need to verify that he is enabled the 2FA
             *          if he didn't we can safely continue from here
             *          but if he did, we will have to give him another
             *          short expiry payload with mfa_required set to true !
             *          and redirect him to the verification route, ...
             *          where he can verify him self and either blocked
             *          or allowed to log-in in this case he will be offered
             *          a JWT with mfa_required set to false !
             */
            const payload = {
                uid: user.id,
                createdAt: user.createdAt,
                mfa_required: false
            };
            token = req.jwt.sign(payload, {
                expiresIn: "15m"
            });

            const refresh_token = uuid();
            await prisma.refreshToken.create({
                data: {
                    userId: user.id!,
                    token: refresh_token,
                    expiredAt: new Date(Date.now() + 2592000000)
                }
            });
            if(!checkRateLimit(user.id, 2, 10000)) {
                return rep.code(400).send({
                    statusCode: 400,
                    message: 'rate limit exeeded!'
                });
            }

            token = req.jwt.sign(payload);

            if (!token) {
                fastify.log.error('token not signed!');
            }
            rep.setCookie('access_token', token, {
                path: '/',
                httpOnly: true,
                secure: true
            });

            rep.setCookie('refresh_token', refresh_token, {
                path: '/',
                httpOnly: true,
                secure: true
            });

            rep.code(200).send({
                access_token: token,
                refresh_token,
                uid: user.id,
                message: 'login successfully'
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
    const user: UserModel | null = await req.server.service.user.fetchBy(
        { id: req.user.uid });
    if (user !== null) {
        rep.code(200).send({
            uid: user.id,
            name: user.name,
            avatar: user.avatar,
            createdAt: user.createdAt
        });
    }
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

export const userLogoutController = async (
    req: FastifyRequest, rep: FastifyReply
): Promise<void> => {
    const token = req.cookies.access_token;
    if (!token) {
        return rep.code(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'you\'re not logged in!'
        })
    }

    try {
        const decoded = req.jwt.decode<{ exp?: number }>(token);
        if (decoded?.exp) {
            await prisma.blacklistedToken.create({
                data: {
                    token,
                    expiresAt: new Date(decoded.exp * 1000)
                }
            });
        }
        rep.clearCookie('access_token', { path: '/' });
        rep.code(200).send({
            message: 'logged-out successfully!'
        });
    } catch (error) {
        rep.code(400).send({
            statusCode: 400,
            error: 'Bad Request!',
            message: 'Invalid token'
        });
    }
}

export const userRefreshTokController = async (
    req: FastifyRequest, rep: FastifyReply
): Promise<void> => {

    const refreshTokenCookie = req.cookies.refresh_token;

    if (!refreshTokenCookie) {
        return rep.code(400).send({
            message: 'please provide a refresh token!'
        });
    }
    const refreshToken = await prisma.refreshToken.findUnique({
        where: {
            token: refreshTokenCookie!
        }
    });

    if (refreshToken) {
        if (!refreshToken.isValid || refreshToken.expiredAt < new Date()) {
            return rep.code(401).send({
                message: 'refresh token is invalid!'
            });
        } else {
            const user = await prisma.user.findUnique({
                where: { id: refreshToken.userId }
            });

            await prisma.refreshToken.update({
                where: { token: refreshTokenCookie! },
                data: { isValid: false }
            });

            const token = req.jwt.sign({
                uid: refreshToken.userId,
                createdAt: user!.createdAt,
                mfa_required: false
            }, {
                expiresIn: "30d"
            });
            const refresh_token = uuid();
            await prisma.refreshToken.create({
                data: {
                    userId: refreshToken.userId,
                    token: refresh_token,
                    expiredAt: new Date(Date.now() + 2592000000)
                }
            });

            rep.setCookie('access_token', token, {
                path: '/',
                httpOnly: true,
                secure: true
            });

            rep.setCookie('refresh_token', refresh_token, {
                path: '/',
                httpOnly: true,
                secure: true
            });

            rep.code(200).send({
                access_token: token,
                refresh_token
            });
        }
    } else {
        return rep.code(401).send({
            message: 'refresh token not found!'
        });
    }

}
